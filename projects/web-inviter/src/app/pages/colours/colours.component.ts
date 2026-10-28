import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiAccordion, UiAccordionItem } from '@zouriel/ui/accordion';
import { UiAlert } from '@zouriel/ui/alert';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiChoice, UiChoiceGrid, UiColorPicker, UiFormField } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { BackLinkComponent } from '../../shared/back-link/back-link.component';
import {
  CARD_DEFAULT, CARD_PRESETS, ColourSet, NamedColours, PRESETS, REPLY_DEFAULT,
  cardPalette, mix, onAccent, readabilityWarnings, sameColours,
} from '../../shared/utils/guest-colours';

type Section = 'reply' | 'card';

/**
 * The event's Colours page: what invites.blog adds around an uploaded design (the reply button and
 * the guest pages), and the printed QR table card.
 *
 * <p>Picked the way the rest of the app is: named one-tap palettes first (with ones read off the
 * host's own picture on top), and the three raw colours only inside a closed "Fine-tune". Each
 * section previews what guests (or the printer) will get, and says plainly when something will be
 * hard to read.</p>
 *
 * <p>Reply colours exist only for an uploaded design. A template's buttons and pages already follow
 * its Theme step, and the server ignores reply colours for one, so the section isn't drawn.</p>
 */
@Component({
  selector: 'app-colours',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BackLinkComponent, FormsModule, UiAccordion, UiAccordionItem, UiAlert, UiButton, UiCard, UiChoiceGrid,
    UiColorPicker, UiFormField, UiSpinner, UiText,
  ],
  templateUrl: './colours.component.html',
  styleUrl: './colours.component.scss',
})
export class ColoursComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  readonly campaignId = input.required<string>();

  protected readonly loaded = signal(false);
  protected readonly saving = signal(false);
  protected readonly isImported = signal(false);
  protected readonly saveTheDate = signal(false);
  protected readonly designImage = signal<string | null>(null);
  protected readonly suggested = signal<NamedColours[]>([]);
  protected readonly title = signal('');
  protected readonly date = signal('');

  protected readonly reply = signal<ColourSet>(REPLY_DEFAULT);
  protected readonly card = signal<ColourSet>(CARD_DEFAULT);

  /** What is saved, to tell whether there is anything to save. */
  private readonly savedReply = signal<ColourSet>(REPLY_DEFAULT);
  private readonly savedCard = signal<ColourSet>(CARD_DEFAULT);

  protected readonly dirty = computed(
    () => !sameColours(this.reply(), this.savedReply()) || !sameColours(this.card(), this.savedCard()),
  );

  /** Reply colours only on an uploaded invitation that takes replies. */
  protected readonly showReply = computed(() => this.isImported() && !this.saveTheDate());

  // ----- the tiles -----

  private readonly replyOptions = computed<NamedColours[]>(() => [...this.suggested(), ...PRESETS]);

  private readonly cardOptions = computed<NamedColours[]>(() => [
    ...(this.showReply() ? [{ id: 'same', name: 'Same as the reply button', colours: this.reply() }] : []),
    ...this.suggested(),
    ...CARD_PRESETS,
  ]);

  protected readonly replyChoices = computed(() => this.choices(this.replyOptions()));
  protected readonly cardChoices = computed(() => this.choices(this.cardOptions()));

  /** The tile matching the current colours, so the grid shows it chosen; none once fine-tuned. */
  protected readonly replyValue = computed(() => this.replyOptions().find((o) => sameColours(o.colours, this.reply()))?.id ?? null);
  protected readonly cardValue = computed(() => this.cardOptions().find((o) => sameColours(o.colours, this.card()))?.id ?? null);

  private choices(options: NamedColours[]): UiChoice[] {
    return options.map((o) => ({
      value: o.id,
      label: o.name,
      group: o.id.startsWith('suggest') ? 'From your design' : o.id === 'same' ? 'Match' : 'Palettes',
    }));
  }

  protected swatches(section: Section, id: string): ColourSet | null {
    return (section === 'reply' ? this.replyOptions() : this.cardOptions()).find((o) => o.id === id)?.colours ?? null;
  }

  protected pick(section: Section, id: string | null): void {
    const set = id ? this.swatches(section, id) : null;
    if (!set) return;
    (section === 'reply' ? this.reply : this.card).set({ ...set });
  }

  protected setOne(section: Section, key: keyof ColourSet, value: string): void {
    if (!/^#[0-9a-f]{6}$/i.test(value)) return;
    (section === 'reply' ? this.reply : this.card).update((c) => ({ ...c, [key]: value.toLowerCase() }));
  }

  // ----- previews -----

  protected readonly replyLabel = computed(() => onAccent(this.reply().accent));
  protected readonly replyCardBg = computed(() => mix(this.reply().background, this.reply().text, 0.07));
  protected readonly replyMuted = computed(() => mix(this.reply().text, this.reply().background, 0.38));
  protected readonly cardColours = computed(() => cardPalette(sameColours(this.card(), CARD_DEFAULT) ? null : this.card()));

  protected readonly replyWarnings = computed(() => readabilityWarnings(this.reply()));
  protected readonly cardWarnings = computed(() => readabilityWarnings(this.card()));

  // ----- loading and saving -----

  ngOnInit(): void {
    this.api.getCampaignSummaryQuiet(this.campaignId()).subscribe({
      next: (s) => {
        this.title.set(s.title);
        this.date.set(
          new Date(s.eventStartAt).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Indian/Maldives',
          }),
        );
      },
      error: () => {},
    });
    this.api.guestColours(this.campaignId()).subscribe({
      next: (c) => {
        this.isImported.set(c.isImported);
        this.saveTheDate.set(c.saveTheDate);
        this.designImage.set(c.designImageUrl);
        this.suggested.set(c.suggested.map((s, i) => ({ id: `suggest-${i}`, name: s.name, colours: s.colours })));
        this.apply(c.reply, c.card);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }

  private apply(reply: ColourSet | null, card: ColourSet | null): void {
    this.reply.set(reply ?? REPLY_DEFAULT);
    this.savedReply.set(reply ?? REPLY_DEFAULT);
    this.card.set(card ?? CARD_DEFAULT);
    this.savedCard.set(card ?? CARD_DEFAULT);
  }

  protected save(): void {
    if (this.saving()) return;
    this.saving.set(true);
    // The defaults are stored as "nothing chosen", so a later change to a default reaches this event too.
    const reply = !this.showReply() || sameColours(this.reply(), REPLY_DEFAULT) ? null : this.reply();
    const card = sameColours(this.card(), CARD_DEFAULT) ? null : this.card();
    this.api.saveGuestColours(this.campaignId(), reply, card).subscribe({
      next: (c) => {
        this.saving.set(false);
        this.apply(c.reply, c.card);
        this.toast.success('Colours saved. Guests see them the next time they open the invitation.');
      },
      error: () => this.saving.set(false),
    });
  }

  protected undo(): void {
    this.reply.set(this.savedReply());
    this.card.set(this.savedCard());
  }
}
