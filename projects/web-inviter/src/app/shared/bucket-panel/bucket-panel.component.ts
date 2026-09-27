import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiConfirmDialog, UiModal, UiToastService } from '@zouriel/ui/dialog';
import { UiFormField, UiInput, UiSwitch } from '@zouriel/ui/form';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../api/api.service';
import { MediaBucket, MediaBucketQr } from '../utils/types/api.types';
import { catalog, formatBytes, mvr, plan, planLabel } from '../utils/plans';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { APP_ICONS } from '../icons/app-icons';

/**
 * One bucket, as the thing its owner administers — <b>a card per bucket, not one card per event</b>.
 *
 * <p>An event can hold several albums with a pass: a ceremony and an after-party,
 * each with its own night and its own people. Everything that decides what a bucket IS therefore has
 * to be asked <i>of a particular one</i> — what it is called, the code that adds to it, how big it
 * is. A single "contribution code" panel on the dashboard could only ever mean the default bucket,
 * and silently meaning one of several is how a host prints the ceremony's code and puts it on the
 * after-party's tables.</p>
 *
 * <p>It lives on the DASHBOARD rather than beside the photographs. Handing out a code, naming a
 * bucket and buying it more room are all running the event — the same act as adding a guest or
 * sending an invitation — while the media tab is for looking at what came back. The only bucket
 * thing that belongs over there is how full it is, which is <code>app-bucket-size</code>.</p>
 *
 * <p><b>The size sits folded away.</b> It is the least-often-touched of the three and the only one
 * that costs money; open on arrival it would read as a thing being asked of the host every time they
 * came to print a code.</p>
 *
 * <p><b>One component, two homes.</b> A bucket attached to an event belongs on that event's
 * dashboard, because a host running a party should not have to go somewhere else to print the code
 * for it. A standalone bucket has its own page, because there is no event to put it on. Those are
 * the same controls, and keeping them in one place is what stops the two drifting into offering
 * different things.</p>
 *
 * <p><b>No cover and no who-can-see — deliberately.</b> Both belong to the event: it is the campaign
 * that has a cover and holds the guest list, and it shares them with its invitation. A bucket
 * carrying its own copies would be a second answer to questions that already have one. The name is
 * the exception, and only became one when an event could hold more than one bucket — "Night's
 * bucket" twice over names nothing.</p>
 */
@Component({
  selector: 'app-bucket-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent,
    DatePipe, NgTemplateOutlet, FormsModule, RouterLink, UiBadge, UiButton, UiCard,
    UiConfirmDialog, UiFormField, UiInput, UiModal, UiSwitch, UiText,
  ],
  templateUrl: './bucket-panel.component.html',
  styleUrl: './bucket-panel.component.scss',
})
export class BucketPanelComponent implements OnInit {
  protected readonly appIcons = APP_ICONS;
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  readonly bucketId = input.required<string>();

  /** Without the card around it, for the bucket's settings modal. */
  readonly plain = input(false);

  /** The bucket, given by whoever already loaded it, so the dashboard does not fetch it twice. */
  readonly initial = input<MediaBucket | null>(null);

  /**
   * The bucket after this card changed it. Renaming and its window happen HERE but are drawn
   * elsewhere too — the fullness bar over the media grid, the heading on a bucket's own page — and
   * a page that kept its own copy would go on showing the old name until it was reloaded.
   */
  readonly changed = output<MediaBucket>();

  /** Set only by this card's own edits; until then the one we were given is the truth. */
  private readonly edited = signal<MediaBucket | null>(null);
  protected readonly bucket = computed(() => this.edited() ?? this.initial());

  // ---------- the code ----------

  protected readonly codes = signal<MediaBucketQr[]>([]);

  /**
   * The code the card keeps on show: the newest one that still works. This is the whole reason
   * codes are stored as rendered images — the token is hashed and cannot be read back, so without
   * the picture a host who printed a card last week would have nothing to reprint from.
   */
  protected readonly latestCode = computed(() => this.codes().find((c) => !c.revoked) ?? null);
  protected readonly retiredCodes = computed(() => this.codes().filter((c) => c.revoked));

  protected readonly makingCode = signal(false);
  protected readonly codeAnonymous = signal(true);
  protected readonly creatingCode = signal(false);


  protected readonly revoking = signal<MediaBucketQr | null>(null);
  protected readonly confirmingRevoke = signal(false);

  // ---------- the name ----------

  protected readonly renaming = signal(false);
  protected readonly savingName = signal(false);
  protected draftName = '';

  ngOnInit(): void {
    if (!this.initial()) {
      this.api.mediaBucket(this.bucketId()).subscribe({ next: (b) => this.edited.set(b) });
    }

    this.api.mediaBucketQrs(this.bucketId()).subscribe({
      next: (codes) => this.codes.set(codes),
      error: () => this.codes.set([]),
    });
  }

  /** Passes a change on to whoever is drawing this bucket somewhere else as well. */
  private adopt(bucket: MediaBucket): void {
    this.edited.set(bucket);
    this.changed.emit(bucket);
  }

  // ---------- the name ----------

  /**
   * Opens the rename box, or says why it cannot be used.
   *
   * <p>Checked here rather than by hiding the control. Somebody who cannot rename a bucket still
   * benefits from knowing the name is a thing that exists and what it would be for.</p>
   */
  protected startRename(bucket: MediaBucket): void {
    if (bucket.maxBuckets <= 1) {
      this.toast.info('Naming albums comes with a Party or Wedding pass.');
      return;
    }
    this.draftName = bucket.name;
    this.renaming.set(true);
  }

  protected saveName(): void {
    if (this.savingName()) return;
    this.savingName.set(true);
    this.api.renameMediaBucket(this.bucketId(), this.draftName).subscribe({
      next: (updated) => {
        this.adopt(updated);
        this.savingName.set(false);
        this.renaming.set(false);
        this.toast.success(`Renamed to ${updated.name}.`);
      },
      error: () => this.savingName.set(false),
    });
  }

  /** How full the event is, against the space its plan gives it. */
  protected used(bucket: MediaBucket): string {
    return `${formatBytes(bucket.eventUsedBytes)} of ${formatBytes(bucket.capacityBytes)}`;
  }

  // ---------- the table card ----------

  /**
   * A card to print and stand on the tables: the venue's name and logo when the event is at one, the
   * event, the code, and one line on what to do. A Free event's card carries a small "Made with
   * invites.blog" — every guest at every table reads it, which is the point of it.
   *
   * <p>Built as its own small page and printed from there, so nothing of the dashboard comes along.
   * A6, one card to a sheet: the size of a table-number card.</p>
   */
  /**
   * The table card: one centred card on an A4 sheet, to print and stand on the tables. The event's
   * name large, one line on what to do, the code big enough to scan from a seat, and a little
   * ornament so it looks like part of the evening rather than a notice.
   */
  protected printCard(bucket: MediaBucket, code: MediaBucketQr): void {
    const win = window.open('', '_blank');
    if (!win) {
      this.toast.info('Allow pop-ups for this site to print the card.');
      return;
    }
    const esc = (v: string) => v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const abs = (u: string) => new URL(u, window.location.origin).href;
    const date = bucket.eventDate
      ? new Date(bucket.eventDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Indian/Maldives' })
      : '';
    const venue = bucket.venueName
      ? `<div class="venue">${bucket.venueLogoUrl ? `<img src="${esc(abs(bucket.venueLogoUrl))}" alt="">` : ''}<span>${esc(bucket.venueName)}</span></div>`
      : '';
    const made = bucket.branded ? '<p class="made">invites.blog</p>' : '';
    // A sprig: drawn once, turned for each corner.
    // A vine that follows the corner's two edges, with leaves turned inward; drawn once, rotated per corner.
    const sprig = '<path d="M6 4 Q6 54 56 54" /><path d="M6 16 q10-1 13-10 q-10 0-13 10z M7 29 q11 0 15-9 q-11-1-15 9z M12 41 q11 2 17-6 q-11-2-17 6z M22 50 q10 4 18-2 q-10-4-18 2z M36 53 q9 5 17 1 q-8-6-17-1z" />';
    const corner = (where: string) => `<svg class="corner ${where}" viewBox="0 0 60 60" aria-hidden="true">${sprig}</svg>`;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(bucket.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Jost:wght@400;500&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body { display: grid; place-items: center; width: 210mm; height: 297mm; color: #2b2622; background: #fff;
         font-family: 'Jost', system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .card { position: relative; width: 150mm; height: 212mm; padding: 20mm 16mm 16mm; text-align: center;
          display: flex; flex-direction: column; align-items: center; justify-content: space-between;
          background: #fbf8f3; border: 0.6mm solid #b89b6a; outline: 0.3mm solid #b89b6a; outline-offset: -3.2mm; }
  .corner { position: absolute; width: 22mm; height: 22mm; fill: none; stroke: #b89b6a; stroke-width: 1.4; }
  .corner path + path { fill: #d9c7a3; stroke: none; }
  .tl { top: 5mm; left: 5mm; transform: rotate(90deg); }
  .tr { top: 5mm; right: 5mm; transform: rotate(180deg); }
  .bl { bottom: 5mm; left: 5mm; }
  .br { bottom: 5mm; right: 5mm; transform: rotate(-90deg); }
  .venue { display: flex; align-items: center; justify-content: center; gap: 3mm; font: 500 8pt/1.2 'Jost', sans-serif;
           letter-spacing: .2em; text-transform: uppercase; color: #8a7f70; margin-bottom: 5mm; }
  .venue img { height: 10mm; max-width: 26mm; object-fit: contain; }
  .kicker { font: 500 9pt/1 'Jost', sans-serif; letter-spacing: .32em; text-transform: uppercase; color: #9a8558; margin: 0; }
  h1 { font: 600 28pt/1.1 'Cormorant Garamond', Georgia, serif; margin: 5mm 0 0; }
  .date { font: italic 500 13pt/1 'Cormorant Garamond', Georgia, serif; color: #6f655a; margin: 3mm 0 0; }
  .rule { display: flex; align-items: center; gap: 3mm; width: 60mm; margin: 7mm auto 0; color: #b89b6a; }
  .rule::before, .rule::after { content: ''; flex: 1; height: 0.3mm; background: currentColor; }
  .rule span { font-size: 9pt; }
  .ask { font: 600 19pt/1.2 'Cormorant Garamond', Georgia, serif; margin: 0; }
  .frame { padding: 4mm; background: #fff; border: 0.3mm solid #e4d8c1; border-radius: 3mm; }
  .qr { display: block; width: 78mm; height: 78mm; }
  .how { font: 400 10pt/1.5 'Jost', sans-serif; color: #6f655a; margin: 0; max-width: 95mm; }
  .made { font: 500 7pt/1 'Jost', sans-serif; letter-spacing: .18em; text-transform: uppercase; color: #b3a995; margin: 4mm 0 0; }
</style></head><body><div class="card">
  ${corner('tl')}${corner('tr')}${corner('bl')}${corner('br')}
  <div>
    ${venue}
    <p class="kicker">Share the moment</p>
    <h1>${esc(bucket.title)}</h1>
    ${date ? `<p class="date">${esc(date)}</p>` : ''}
    <div class="rule"><span>&#10086;</span></div>
  </div>
  <p class="ask">Add your photos &amp; videos</p>
  <div class="frame"><img class="qr" src="${esc(abs(code.imageUrl))}" alt=""></div>
  <div>
    <p class="how">Open your phone's camera, point it at the code, and tap the link. No app needed.</p>
    ${made}
  </div>
</div>
<script>
  // Waits for the fonts and the code, or the print catches the page half-drawn.
  const ready = Promise.all([document.fonts ? document.fonts.ready : Promise.resolve(),
    ...[...document.images].map((i) => i.complete ? Promise.resolve() : new Promise((r) => { i.onload = i.onerror = r; }))]);
  window.onload = () => ready.then(() => { window.focus(); window.print(); });
</script>
</body></html>`);
    win.document.close();
  }

  /** The longest any plan allows (the Wedding pass's), and every length up to it. */
  protected readonly longestWindow = plan('WeddingPass').maxWindowDays ?? 5;
  protected readonly windowChoices = Array.from({ length: this.longestWindow }, (_, i) => i + 1);
  protected readonly savingWindow = signal(false);

  /** The longest window this bucket can have: what the plan gives, or what it already has. */
  protected windowMost(bucket: MediaBucket): number {
    return Math.max(bucket.maxWindowDays ?? 1, bucket.windowDays ?? 1);
  }

  protected saveWindow(bucket: MediaBucket, days: number): void {
    if (this.savingWindow()) return;
    this.savingWindow.set(true);
    this.api.setBucketWindow(bucket.id, days).subscribe({
      next: (updated) => {
        this.adopt(updated);
        this.savingWindow.set(false);
        this.toast.success(`${updated.name} now collects for ${days} ${days === 1 ? 'day' : 'days'}.`);
      },
      error: () => this.savingWindow.set(false),
    });
  }

  /** The sizes an event can have, and which plans give them. From the one catalog, like the pricing page. */
  protected readonly sizes = (['Free', 'PartyPass', 'WeddingPass'] as const).map((kind) => ({
    kind,
    label: formatBytes(plan(kind).eventBytes!),
    plan: planLabel(kind),
  }));
  protected readonly party = plan('PartyPass');

  /** Free, then the passes, then a venue: which way is up. */
  protected rank(kind: string): number {
    return ['Free', 'PartyPass', 'WeddingPass', 'Venue'].indexOf(kind);
  }

  protected readonly keepPrice = `${mvr(catalog().keepPhotos.price)} a year`;

  /** Where the event is in its cover, in words: until when, or which part of the wind-down. */
  protected keptLine(b: MediaBucket): string {
    const lapse = catalog().lapse;
    const d = (iso: string | null, days = 0) =>
      iso ? new Date(new Date(iso).getTime() + days * 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    switch (b.phase) {
      case 'UploadsClosed':
        return `Guests can look until ${d(b.termEndAt, lapse.organiserOnlyDay)}. Removed on ${d(b.termEndAt, lapse.deleteDay)}.`;
      case 'OrganiserOnly':
        return `Only you can see them. Removed on ${d(b.termEndAt, lapse.deleteDay)}.`;
      case 'Deleted':
        return 'These photos have been removed.';
      default:
        return b.termEndAt
          ? `Kept until ${d(b.termEndAt)}.`
          : `Kept while ${b.venueName ?? 'the venue'}'s plan runs.`;
    }
  }


  // ---------- the code ----------

  protected createCode(): void {
    if (this.creatingCode()) return;
    this.creatingCode.set(true);
    this.api
      .createMediaBucketQr(this.bucketId(), {
        label: null,
        allowAnonymous: this.codeAnonymous(),
      })
      .subscribe({
        next: (code) => {
          this.codes.update((all) => [code, ...all]);
          this.creatingCode.set(false);
          this.makingCode.set(false);
        },
        error: () => this.creatingCode.set(false),
      });
  }

  protected askToRevoke(code: MediaBucketQr): void {
    this.revoking.set(code);
    this.confirmingRevoke.set(true);
  }

  protected revoke(): void {
    const code = this.revoking();
    if (!code) return;
    this.api.revokeMediaBucketQr(this.bucketId(), code.id).subscribe({
      next: () => {
        this.codes.update((all) => all.map((c) => (c.id === code.id ? { ...c, revoked: true } : c)));
        this.revoking.set(null);
        this.toast.success('That code no longer works.');
      },
      error: () => this.revoking.set(null),
    });
  }

  protected copy(link: string): void {
    void navigator.clipboard
      ?.writeText(link)
      .then(() => this.toast.success('Link copied.'))
      .catch(() => this.toast.danger('Could not copy that link.'));
  }
}
