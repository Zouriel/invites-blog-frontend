import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { UiButton, UiSegmented, type UiSegmentedOption } from '@zouriel/ui/button';
import { UiTextarea } from '@zouriel/ui/form';
import { UiAlert } from '@zouriel/ui/alert';
import { ApiService } from '../../shared/api/api.service';
import { DesignStore } from './design.store';
import type { AiPictureShape, AiPictureStatus } from './model/scene';

const SHAPES: UiSegmentedOption[] = [
  { value: 'square', label: 'Square' }, { value: 'wide', label: 'Wide' }, { value: 'strip', label: 'Strip' }, { value: 'tall', label: 'Tall' },
];

/** One-tap starting points: the things shapes and the free libraries can't do well. */
const IDEAS = ['White lace border', 'Watercolour peonies', 'Gold wax seal', 'Satin ribbon bow', 'Eucalyptus sprig'];

/** Fetched once per visit; refreshed after each picture (the count goes down). */
let statusCache: AiPictureStatus | null = null;

/**
 * "Create with AI", at the top of the Art library tab: type what you want and get a picture with a
 * see-through background (lace, flowers, a wax seal…), placed like library art. Only shown to
 * accounts an admin has allowed (Admin › Designers); each has a monthly number of pictures.
 */
@Component({
  selector: 'app-ai-picture-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiButton, UiSegmented, UiTextarea, UiAlert],
  template: `
    @if (status(); as s) {
      @if (s.allowed) {
        <section class="ai" aria-label="Create with AI">
          <h3 class="title">Create with AI</h3>
          <ui-textarea size="sm" [rows]="2" [autosize]="true" [maxRows]="5" [maxlength]="400" ariaLabel="Describe the picture you want"
            placeholder="Describe one thing: white floral lace border, fine thread detail" [ngModel]="prompt()" (ngModelChange)="prompt.set($event ?? '')"
            (keydown.control.enter)="create()" (keydown.meta.enter)="create()" />
          <div class="ideas" role="group" aria-label="Ideas">
            @for (idea of ideas; track idea) {
              <ui-button size="sm" variant="ghost" (click)="prompt.set(idea)">{{ idea }}</ui-button>
            }
          </div>
          <div class="row">
            <ui-segmented size="sm" label="Shape" [options]="shapes" [value]="shape()" (valueChange)="$event && shape.set($any($event))" />
            <ui-button size="sm" [loading]="busy()" [disabled]="!canCreate()" (click)="create()">Create</ui-button>
          </div>
          @if (busy()) {
            <p class="note" role="status">Making your picture — this takes a few seconds.</p>
          }
          @if (error(); as message) {
            <ui-alert tone="warning" [heading]="message">
              <ui-button size="sm" variant="outline" (click)="error.set(null)">OK</ui-button>
            </ui-alert>
          }
          <p class="note">{{ left() }} The background comes out see-through; describe the thing, not a scene.</p>
        </section>
      }
    }
  `,
  styles: `
    :host { display: block; }
    .ai { display: flex; flex-direction: column; gap: var(--ui-space-2); padding-bottom: var(--ui-space-3); border-bottom: 1px solid var(--ui-color-border); }
    .title { margin: 0; font-size: var(--ui-font-size-sm); font-weight: 600; }
    .ideas { display: flex; gap: var(--ui-space-1); overflow-x: auto; scrollbar-width: none; margin-inline: calc(-1 * var(--ui-space-1)); }
    .ideas::-webkit-scrollbar { display: none; }
    .row { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: var(--ui-space-2); }
    .note { margin: 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
  `,
})
export class AiPictureBarComponent {
  private readonly api = inject(ApiService);
  private readonly store = inject(DesignStore);

  /** A picture was put on the page (the phone layout closes its panel on this). */
  readonly added = output<void>();

  protected readonly shapes = SHAPES;
  protected readonly ideas = IDEAS;
  protected readonly status = signal<AiPictureStatus | null>(statusCache);
  protected readonly prompt = signal('');
  protected readonly shape = signal<AiPictureShape>('square');
  protected readonly busy = signal(false);
  /** Stays until dismissed: a refusal says why, and vanishing before it's read helps no one. */
  protected readonly error = signal<string | null>(null);

  protected readonly canCreate = computed(() => !this.busy() && this.prompt().trim().length > 0 && !!this.status()?.available);

  protected readonly left = computed(() => {
    const s = this.status();
    if (!s) return '';
    if (s.reason === 'unavailable') return 'Creating pictures isn’t available right now.';
    const resets = new Date(s.resetsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
    if (s.reason === 'limit') return `You’ve made this month’s ${s.limit} pictures; more on ${resets}.`;
    const n = Math.max(0, s.limit - s.used);
    return `${n} of ${s.limit} pictures left this month.`;
  });

  constructor() {
    if (!statusCache) void this.refresh();
  }

  private async refresh(): Promise<void> {
    try {
      const s = await firstValueFrom(this.api.aiPictureStatus());
      statusCache = s;
      this.status.set(s);
    } catch {
      // Not shown: the bar is an extra, and the art library below works without it.
    }
  }

  protected async create(): Promise<void> {
    if (!this.canCreate()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.store.createAiPicture(this.prompt().trim(), this.shape());
      this.added.emit();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'That picture couldn’t be made — try again.');
    } finally {
      this.busy.set(false);
      await this.refresh();
    }
  }
}

/** For tests: forget the cached status between them. */
export function resetAiPictureStatus(): void {
  statusCache = null;
}
