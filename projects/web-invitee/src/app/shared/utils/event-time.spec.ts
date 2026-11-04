import {
  LEGACY_EVENT_ZONE,
  eventClock,
  eventDay,
  localDate,
  setViewerLocale,
  formatEventTime,
  instantToWallTime,
  offsetMinutes,
  timeZoneOptions,
  wallTimeToInstant,
  zoneLabel,
} from './event-time';

describe('event time zones', () => {
  describe('a London host and a New York guest', () => {
    // Saturday 24 October 2026, 7 pm in London (BST, UTC+1) = 18:00 UTC = 2 pm in New York (EDT).
    const at = wallTimeToInstant('2026-10-24', '19:00', 'Europe/London')!;

    it('stores the picked wall time as the right instant', () => {
      expect(at).toBe('2026-10-24T18:00:00.000Z');
    });

    it('shows the London time and zone to the host, with no "your time"', () => {
      expect(eventClock(at, 'Europe/London', 'Europe/London')).toBe('19:00 BST');
    });

    it('shows the guest in New York their own time beside it', () => {
      expect(eventClock(at, 'Europe/London', 'America/New_York')).toBe('19:00 BST (14:00 your time)');
      expect(formatEventTime(at, 'Europe/London', { viewerZone: 'America/New_York' })).toBe(
        'Saturday, 24 October 2026 · 19:00 BST (14:00 your time)',
      );
    });

    it('reads back into the same date and time for the date pickers', () => {
      expect(instantToWallTime(at, 'Europe/London')).toEqual({ date: '2026-10-24', time: '19:00' });
    });
  });

  describe('a Maldives event viewed from Sydney', () => {
    // Friday 20 November 2026, 7 pm in Malé (UTC+5) = 14:00 UTC = Saturday 1 am in Sydney (AEDT, UTC+11).
    const at = wallTimeToInstant('2026-11-20', '19:00', 'Indian/Maldives')!;

    it('converts with Malé’s offset', () => {
      expect(at).toBe('2026-11-20T14:00:00.000Z');
    });

    it('labels the event’s zone and gives the Sydney time with its day, since it is the next day there', () => {
      expect(formatEventTime(at, 'Indian/Maldives', { viewerZone: 'Australia/Sydney' })).toMatch(
        /^Friday, 20 November 2026 · 19:00 GMT\+5 \(Sat 0?1:00 your time\)$/,
      );
    });

    it('keeps the event’s own day in lists, whatever the viewer’s', () => {
      expect(eventDay(at, 'Indian/Maldives', 'short')).toBe('20 Nov 2026');
      expect(eventDay(at, 'Australia/Sydney', 'short')).toBe('21 Nov 2026');
    });
  });

  describe('Europe/London on 25 October 2026, when the clocks go back', () => {
    it('uses summer time the day before and winter time the day after', () => {
      expect(wallTimeToInstant('2026-10-24', '12:00', 'Europe/London')).toBe('2026-10-24T11:00:00.000Z');
      expect(wallTimeToInstant('2026-10-26', '12:00', 'Europe/London')).toBe('2026-10-26T12:00:00.000Z');
      expect(zoneLabel('2026-10-24T11:00:00Z', 'Europe/London')).toBe('BST');
      expect(zoneLabel('2026-10-26T12:00:00Z', 'Europe/London')).toBe('GMT');
    });

    it('is right on the day itself, either side of the change at 2 am', () => {
      // 1:30 happens twice: the first one (BST) is taken.
      expect(wallTimeToInstant('2026-10-25', '01:30', 'Europe/London')).toBe('2026-10-25T00:30:00.000Z');
      // After the change it is GMT.
      expect(wallTimeToInstant('2026-10-25', '19:00', 'Europe/London')).toBe('2026-10-25T19:00:00.000Z');
      expect(eventClock('2026-10-25T19:00:00Z', 'Europe/London', 'Europe/London')).toBe('19:00 GMT');
      expect(offsetMinutes('2026-10-25T00:30:00Z', 'Europe/London')).toBe(60);
      expect(offsetMinutes('2026-10-25T01:30:00Z', 'Europe/London')).toBe(0);
    });

    it('moves a time the spring change skips to just after it', () => {
      // 29 March 2026: 1:00 GMT jumps to 2:00 BST, so 1:30 doesn't exist; it lands at 2:30 BST.
      expect(wallTimeToInstant('2026-03-29', '01:30', 'Europe/London')).toBe('2026-03-29T01:30:00.000Z');
    });

    it('adds no "your time" when the viewer’s clock reads the same, even in another zone id', () => {
      expect(eventClock('2026-10-25T19:00:00Z', 'Europe/London', 'Europe/Lisbon')).toBe('19:00 GMT');
    });
  });

  it('spells offset zero "GMT" whatever the ICU build says (Chromium says "GMT+0")', () => {
    const orig = Intl.DateTimeFormat;
    const fake = function (this: unknown, ...args: ConstructorParameters<typeof Intl.DateTimeFormat>) {
      const real = new orig(...args);
      return Object.assign(Object.create(real), {
        formatToParts: (d?: Date) => real.formatToParts(d).map((p) => (p.type === 'timeZoneName' ? { ...p, value: 'GMT+0' } : p)),
      });
    } as unknown as typeof Intl.DateTimeFormat;
    (Intl as { DateTimeFormat: typeof Intl.DateTimeFormat }).DateTimeFormat = fake;
    try {
      expect(zoneLabel('2026-12-12T19:00:00Z', 'Europe/London')).toBe('GMT');
    } finally {
      (Intl as { DateTimeFormat: typeof Intl.DateTimeFormat }).DateTimeFormat = orig;
    }
  });

  it('falls back to Malé for an event with no zone, as every event before zones had', () => {
    expect(LEGACY_EVENT_ZONE).toBe('Indian/Maldives');
    expect(wallTimeToInstant('2026-12-01', '18:00', null)).toBe('2026-12-01T13:00:00.000Z');
  });

  it('shows only the day for an all-day event', () => {
    expect(formatEventTime('2026-12-01T07:00:00Z', 'Europe/London', { allDay: true, viewerZone: 'Asia/Tokyo' })).toBe(
      'Tuesday, 1 December 2026',
    );
  });

  it('refuses dates that aren’t dates', () => {
    expect(wallTimeToInstant('1/12/2026', '18:00', 'Europe/London')).toBeNull();
    expect(formatEventTime('', 'Europe/London')).toBe('');
  });

  it('lists every zone with its offset, the browser’s and Malé’s included', () => {
    const list = timeZoneOptions(Date.parse('2026-11-20T00:00:00Z'));
    expect(list.length).toBeGreaterThan(300);
    expect(list.find((o) => o.value === 'Europe/London')?.label).toBe('Europe/London (GMT)');
    expect(list.find((o) => o.value === 'Indian/Maldives')?.label).toBe('Indian/Maldives (GMT+5)');
  });
});

describe('dates follow the viewer, not a fixed locale', () => {
  afterEach(() => setViewerLocale('en-GB'));
  // Thursday 5 November 2026, 9 pm in Malé (UTC+5) = 16:00 UTC.
  const at = '2026-11-05T16:00:00Z';

  it('writes day before month for a British viewer and month first for an American, always with the month as a word', () => {
    setViewerLocale('en-GB');
    expect(eventDay(at, 'Indian/Maldives', 'long')).toBe('5 November 2026');
    setViewerLocale('en-US');
    expect(eventDay(at, 'Indian/Maldives', 'long')).toBe('November 5, 2026');
  });

  it('uses the 12 or 24 hour clock the locale uses', () => {
    setViewerLocale('en-GB');
    expect(eventClock(at, 'Indian/Maldives', 'Indian/Maldives')).toBe('21:00 GMT+5');
    setViewerLocale('en-US');
    expect(eventClock(at, 'Indian/Maldives', 'Indian/Maldives')).toBe('9:00 PM GMT+5');
  });

  it('adds "your time" for London, New York and Sydney viewers of a Maldives event', () => {
    setViewerLocale('en-GB');
    expect(eventClock(at, 'Indian/Maldives', 'Europe/London')).toBe('21:00 GMT+5 (16:00 your time)');
    expect(eventClock(at, 'Indian/Maldives', 'America/New_York')).toBe('21:00 GMT+5 (11:00 your time)');
    expect(eventClock(at, 'Indian/Maldives', 'Australia/Sydney')).toMatch(/^21:00 GMT\+5 \(Fri 0?3:00 your time\)$/);
  });

  it('follows daylight saving in the viewer\'s zone: the same event is one hour apart either side of the change', () => {
    // New York leaves daylight saving on 1 Nov 2026 (EDT -> EST).
    expect(eventClock('2026-10-31T16:00:00Z', 'Indian/Maldives', 'America/New_York')).toContain('(12:00 your time)');
    expect(eventClock('2026-11-02T16:00:00Z', 'Indian/Maldives', 'America/New_York')).toContain('(11:00 your time)');
  });

  it('shows a moment that is not an event\'s on the viewer\'s own clock', () => {
    setViewerLocale('en-GB');
    expect(localDate(at, 'short', 'Europe/London')).toBe('5 Nov 2026');
    expect(localDate(at, 'datetime', 'Australia/Sydney')).toMatch(/^6 Nov 2026, 0?3:00$/);
    expect(localDate(at, 'time', 'America/New_York')).toBe('11:00');
    expect(localDate(null)).toBe('');
  });
});

