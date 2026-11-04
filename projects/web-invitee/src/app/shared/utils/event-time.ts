/**
 * An event's clock.
 *
 * <p>Event times travel as instants (ISO strings with Z or an offset) together with the event's own
 * IANA time zone ("Europe/London"). Every place that shows one formats it on the EVENT's clock with a
 * short zone label ("7:00 pm GMT"), and adds the viewer's own time when their clock reads differently
 * ("(2:00 pm your time)"). A picked date and time is read as wall time in the event's zone and turned
 * into an instant here, so daylight saving is handled by the zone database, never by a fixed offset.</p>
 *
 * <p>Events from before time zones existed come back with "Indian/Maldives", so nothing shifts.</p>
 *
 * <p>The same file lives in both apps (web-inviter and web-invitee); keep them identical.</p>
 */

/** The zone events had before each event had its own: Malé's. */
export const LEGACY_EVENT_ZONE = 'Indian/Maldives';

/** What a viewer sees when their browser names no usable language. */
const FALLBACK_LOCALE = 'en-GB';
let localeOverride: string | null = null;

/** Pins the locale (tests only); null goes back to the browser's. */
export function setViewerLocale(locale: string | null): void {
  localeOverride = locale;
}

/**
 * The viewer's own locale (browser language), so day/month order, month names and 12/24-hour clocks
 * read the way they do everywhere else on their device. Months are always spelled as words, so
 * 05/11 is never ambiguous. Falls back to en-GB where the runtime names no language (SSR, old browsers).
 */
export function viewerLocale(): string {
  if (localeOverride) return localeOverride;
  try {
    const nav = (globalThis as { navigator?: { languages?: readonly string[]; language?: string } }).navigator;
    for (const l of [...(nav?.languages ?? []), nav?.language ?? '']) {
      if (l && Intl.DateTimeFormat.supportedLocalesOf(l).length) return l;
    }
  } catch {
    /* fall through */
  }
  return FALLBACK_LOCALE;
}

/** The browser's own zone, or null where it can't say (very old browsers, SSR without ICU). */
export function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Whether the runtime knows this IANA zone. */
export function isTimeZone(zone: string | null | undefined): zone is string {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat(viewerLocale(), { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function zoneOr(zone: string | null | undefined): string {
  return isTimeZone(zone) ? zone : LEGACY_EVENT_ZONE;
}

function toMs(at: string | number | Date): number {
  return at instanceof Date ? at.getTime() : typeof at === 'number' ? at : Date.parse(at);
}

/** The wall-clock parts of an instant in a zone (24-hour). */
function partsIn(ms: number, zone: string): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(new Date(ms))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  return { y: p['year'], mo: p['month'], d: p['day'], h: p['hour'] % 24, mi: p['minute'], s: p['second'] };
}

/** The zone's offset from UTC at that instant, in minutes (London in summer: 60). */
export function offsetMinutes(at: string | number | Date, zone: string): number {
  const ms = toMs(at);
  const p = partsIn(ms, zone);
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60_000);
}

/**
 * The instant at which the zone's clock reads `date` ("2026-10-25") and `time` ("19:00"), as an ISO
 * string in UTC. DST-safe: the offset is the one in force at that moment. A time that doesn't exist
 * (clocks jumped over it) lands just after the jump; a time that happens twice takes the first.
 */
export function wallTimeToInstant(date: string, time: string, zone: string | null | undefined): string | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '');
  const tm = /^(\d{1,2}):(\d{2})/.exec(time || '00:00');
  if (!dm || !tm) return null;
  const z = zoneOr(zone);
  const guess = Date.UTC(+dm[1], +dm[2] - 1, +dm[3], +tm[1], +tm[2]);
  // Try both offsets around the guess; the earliest instant whose wall time matches wins (the first
  // of a repeated hour). With no match the time was skipped: use the later offset, which moves it
  // forward past the jump.
  const o1 = offsetMinutes(guess, z);
  const o2 = offsetMinutes(guess - o1 * 60_000, z);
  const candidates = [...new Set([o1, o2, offsetMinutes(guess - 3 * 3600_000, z), offsetMinutes(guess + 3 * 3600_000, z)])]
    .map((o) => guess - o * 60_000)
    .filter((ms) => {
      const p = partsIn(ms, z);
      return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) === guess;
    })
    .sort((a, b) => a - b);
  const ms = candidates[0] ?? guess - Math.min(o1, o2) * 60_000;
  return new Date(ms).toISOString();
}

/** The date ("2026-10-25") and time ("19:00") an instant reads on the zone's clock. */
export function instantToWallTime(at: string | null | undefined, zone: string | null | undefined): { date: string; time: string } | null {
  const ms = at ? Date.parse(at) : NaN;
  if (Number.isNaN(ms)) return null;
  const p = partsIn(ms, zoneOr(zone));
  const two = (n: number) => String(n).padStart(2, '0');
  return { date: `${p.y}-${two(p.mo)}-${two(p.d)}`, time: `${two(p.h)}:${two(p.mi)}` };
}

/** The zone's short name at that instant ("GMT", "BST", "GMT+5", "GMT-4"). */
export function zoneLabel(at: string | number | Date, zone: string | null | undefined): string {
  const z = zoneOr(zone);
  const part = new Intl.DateTimeFormat(viewerLocale(), { timeZone: z, timeZoneName: 'short' })
    .formatToParts(new Date(toMs(at)))
    .find((p) => p.type === 'timeZoneName');
  // Some ICU builds (Chromium's) say "GMT+0" where others say "GMT": one spelling everywhere.
  return (part?.value ?? z).replace(/^(GMT|UTC)[+-]0(:00)?$/, 'GMT');
}

/** "7:00 pm" (or "19:00", as the viewer's locale writes it) on the zone's clock. */
export function clockTime(at: string | number | Date, zone: string | null | undefined): string {
  return new Intl.DateTimeFormat(viewerLocale(), { timeZone: zoneOr(zone), hour: 'numeric', minute: '2-digit' })
    .format(new Date(toMs(at)))
    .replace(/[\u202f\u00a0]/g, ' ');
}

export type EventDateStyle = 'full' | 'long' | 'short';

/** The day an instant falls on in the zone: full "Sunday, 25 October 2026", long "25 October 2026", short "25 Oct 2026". */
export function eventDay(at: string | number | Date | null | undefined, zone: string | null | undefined, style: EventDateStyle = 'long'): string {
  if (at === null || at === undefined || at === '') return '';
  const ms = toMs(at);
  if (Number.isNaN(ms)) return '';
  const opts: Intl.DateTimeFormatOptions =
    style === 'full'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : style === 'long'
        ? { day: 'numeric', month: 'long', year: 'numeric' }
        : { day: 'numeric', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat(viewerLocale(), { ...opts, timeZone: zoneOr(zone) }).format(new Date(ms));
}

/**
 * "7:00 pm GMT", plus "(2:00 pm your time)" when the viewer's clock reads differently, and the
 * viewer's day as well when it is another day there ("(Mon 1:00 am your time)").
 */
export function eventClock(
  at: string | number | Date,
  zone: string | null | undefined,
  viewerZone: string | null | undefined = browserTimeZone(),
): string {
  const ms = toMs(at);
  if (Number.isNaN(ms)) return '';
  const z = zoneOr(zone);
  let text = `${clockTime(ms, z)} ${zoneLabel(ms, z)}`;
  if (viewerZone && isTimeZone(viewerZone) && offsetMinutes(ms, viewerZone) !== offsetMinutes(ms, z)) {
    const theirs = instantToWallTime(new Date(ms).toISOString(), z)!;
    const mine = instantToWallTime(new Date(ms).toISOString(), viewerZone)!;
    const day =
      theirs.date !== mine.date
        ? new Intl.DateTimeFormat(viewerLocale(), { timeZone: viewerZone, weekday: 'short' }).format(new Date(ms)) + ' '
        : '';
    text += ` (${day}${clockTime(ms, viewerZone)} your time)`;
  }
  return text;
}

/**
 * The whole line an invitation or a list shows: "Sunday, 25 October 2026 · 7:00 pm GMT (2:00 pm your
 * time)". All-day events show only their day.
 */
export function formatEventTime(
  at: string | null | undefined,
  zone: string | null | undefined,
  opts: { allDay?: boolean; style?: EventDateStyle; viewerZone?: string | null } = {},
): string {
  if (!at || Number.isNaN(Date.parse(at))) return '';
  const day = eventDay(at, zone, opts.style ?? 'full');
  if (opts.allDay) return day;
  return `${day} · ${eventClock(at, zone, opts.viewerZone === undefined ? browserTimeZone() : opts.viewerZone)}`;
}

/** Every zone the browser knows, for a searchable picker: value the IANA id, label with its offset now. */
export function timeZoneOptions(now: number = Date.now()): { label: string; value: string }[] {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  } catch {
    zones = [];
  }
  const all = new Set([...zones, 'UTC', LEGACY_EVENT_ZONE]);
  const b = browserTimeZone();
  if (b) all.add(b);
  return [...all]
    .filter((z) => isTimeZone(z))
    .sort()
    .map((z) => ({ value: z, label: `${z.replace(/_/g, ' ')} (${zoneLabel(now, z)})` }));
}

export type LocalDateStyle = 'short' | 'long' | 'datetime' | 'time' | 'dayMonth' | 'weekdayDay';

/**
 * A moment that is not an event's (a payment, an edit, a block): shown on the VIEWER's own clock and
 * in their locale. `short` "5 Nov 2026", `long` "5 November 2026", `datetime` "5 Nov 2026, 21:30",
 * `time` "21:30", `dayMonth` "5 November", `weekdayDay` "Thursday 5 November".
 */
export function localDate(
  at: string | number | Date | null | undefined,
  style: LocalDateStyle = 'short',
  viewerZone: string | null | undefined = browserTimeZone(),
): string {
  if (at === null || at === undefined || at === '') return '';
  const ms = toMs(at);
  if (Number.isNaN(ms)) return '';
  const zone = isTimeZone(viewerZone) ? viewerZone : undefined;
  const opts: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { day: 'numeric', month: 'long', year: 'numeric' }
      : style === 'datetime'
        ? { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }
        : style === 'time'
          ? { hour: 'numeric', minute: '2-digit' }
          : style === 'dayMonth'
            ? { day: 'numeric', month: 'long' }
            : style === 'weekdayDay'
              ? { weekday: 'long', day: 'numeric', month: 'long' }
              : { day: 'numeric', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat(viewerLocale(), { ...opts, ...(zone ? { timeZone: zone } : {}) })
    .format(new Date(ms))
    .replace(/[\u202f\u00a0]/g, ' ');
}
