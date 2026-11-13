import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiButton } from '@zouriel/ui/button';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiFormField, UiHandleField, UiInput, type UiHandleCheck } from '@zouriel/ui/form';
import { UiStepper, type UiStep } from '@zouriel/ui/navigation';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { APP_ICONS } from '../../shared/icons/app-icons';
import { PortfolioCoverComponent } from '../../shared/portfolio/portfolio-cover.component';
import { PortfolioLogoComponent } from '../../shared/portfolio/portfolio-logo.component';
import { PortfolioLookComponent } from '../../shared/portfolio/portfolio-look.component';
import { PortfolioPhotoPickerComponent, type PortfolioPick } from '../../shared/portfolio/portfolio-photo-picker.component';
import { Portfolio, PortfolioOptions } from '../../shared/portfolio/portfolio.types';
import { handleChecker, handleFromName } from './portfolio-shared';

/**
 * First-time setup (docs/PORTFOLIO.md §5): link name, then logo and name, look, a first collection, publish.
 * Every step but the first can be skipped. Each step saves as it goes, so leaving half way keeps what was done.
 */
@Component({
  selector: 'app-portfolio-wizard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    HugeiconsIconComponent,
    PortfolioCoverComponent,
    PortfolioLogoComponent,
    PortfolioLookComponent,
    PortfolioPhotoPickerComponent,
    UiButton,
    UiFormField,
    UiHandleField,
    UiInput,
    UiStepper,
    UiText,
  ],
  template: `
    <ui-stepper [steps]="steps" [active]="step()" variant="dots" label="Setting up your portfolio" />
    <div class="card">
      @switch (step()) {
        @case (0) {
          <ui-text variant="h3">Choose your link</ui-text>
          <ui-text class="muted">This is the address you share with clients. You can change it later.</ui-text>
          <ui-handle-field
            label="Your link"
            prefix="invites.blog/@"
            [(value)]="handle"
            [check]="check"
            [suggestion]="suggestion()"
            hint="Letters, numbers, dots and underscores"
            (statusChange)="handleState.set($event)"
          />
        }
        @case (1) {
          <ui-text variant="h3">Your name and logo</ui-text>
          <ui-form-field label="Studio name">
            <ui-input [(ngModel)]="name" [ngModelOptions]="{ standalone: true }" autocomplete="organization" />
          </ui-form-field>
          <ui-form-field label="One line about you" hint="For example: Weddings and parties in Addu">
            <ui-input [(ngModel)]="tagline" [ngModelOptions]="{ standalone: true }" />
          </ui-form-field>
          <ui-text variant="h4">Logo</ui-text>
          <app-portfolio-logo [portfolio]="portfolio()" [options]="options()" (changed)="changed.emit($event)" />
          <ui-text variant="h4">Cover picture</ui-text>
          <app-portfolio-cover [portfolio]="portfolio()" (changed)="changed.emit($event)" />
        }
        @case (2) {
          <ui-text variant="h3">Pick a look</ui-text>
          <app-portfolio-look [options]="options()" [(theme)]="theme" [(accent)]="accent" [(font)]="font" />
        }
        @case (3) {
          <ui-text variant="h3">Your first collection</ui-text>
          @if (firstAdded()) {
            <ui-text>{{ firstAdded() }}</ui-text>
          } @else {
            <app-portfolio-photo-picker [error]="addError()" (chosen)="addFirst($event)" />
          }
        }
        @case (4) {
          <ui-text variant="h3">Ready to share</ui-text>
          <ui-text class="muted">Your page will be at</ui-text>
          <ui-text variant="h4" class="link">invites.blog/&#64;{{ portfolio().handle }}</ui-text>
          <ui-text class="muted">You can change everything later, and hide the page again any time.</ui-text>
        }
      }
    </div>

    <div class="nav">
      @if (step() > 0) {
        <ui-button variant="ghost" (click)="step.set(step() - 1)" [disabled]="busy()">
          <hugeicons-icon [icon]="icons.back" [size]="18" [strokeWidth]="1.8" /> Back
        </ui-button>
      } @else {
        <span></span>
      }
      <div class="nav__right">
        @if (step() > 0 && step() < 4) {
          <ui-button variant="ghost" (click)="step.set(step() + 1)" [disabled]="busy()">Skip</ui-button>
        }
        @if (step() < 4) {
          <ui-button variant="primary" [loading]="busy()" [disabled]="!canNext()" (click)="next()">
            Next <hugeicons-icon [icon]="icons.next" [size]="18" [strokeWidth]="1.8" />
          </ui-button>
        } @else {
          <ui-button variant="ghost" [disabled]="busy()" (click)="finish(false)">Not yet</ui-button>
          <ui-button variant="primary" [loading]="busy()" (click)="finish(true)">Publish</ui-button>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--ui-space-4); }
    .card { display: flex; flex-direction: column; gap: var(--ui-space-4); padding: var(--ui-space-6) var(--ui-space-4);
      background: var(--ui-color-surface); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-lg); }
    .muted { color: var(--ui-color-text-muted); }
    .link { word-break: break-all; }
    .nav { display: flex; justify-content: space-between; align-items: center; gap: var(--ui-space-2); flex-wrap: wrap; }
    .nav__right { display: flex; gap: var(--ui-space-2); margin-left: auto; }
  `,
})
export class PortfolioWizardComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);
  protected readonly icons = APP_ICONS;

  readonly portfolio = input.required<Portfolio>();
  readonly options = input<PortfolioOptions | null>(null);
  readonly changed = output<Portfolio>();
  readonly finished = output<Portfolio>();

  protected readonly steps: UiStep[] = [
    { label: 'Link' },
    { label: 'Name & logo' },
    { label: 'Look' },
    { label: 'Photos' },
    { label: 'Publish' },
  ];
  protected readonly step = signal(0);
  protected readonly busy = signal(false);
  protected readonly handleState = signal<UiHandleCheck>({ state: 'idle' });
  protected readonly firstAdded = signal<string | null>(null);
  /** Why the chosen photos couldn't be added: they stay on this step to choose again, or Skip. */
  protected readonly addError = signal<string | null>(null);
  protected readonly check = handleChecker(this.api);

  protected handle = '';
  protected name = '';
  protected tagline = '';
  protected theme: string | null = 'oxblood';
  protected accent: string | null = 'theme';
  protected font: string | null = 'classic';

  protected readonly suggestion = computed(() => this.handleState().suggestion);

  ngOnInit(): void {
    const p = this.portfolio();
    this.handle = p.handle ?? handleFromName(p.displayName);
    this.name = p.displayName;
    this.tagline = p.tagline ?? '';
    this.theme = p.theme;
    this.accent = p.accent;
    this.font = p.font;
    // Someone who left after choosing a link carries on from the next step.
    if (p.handle) this.step.set(1);
  }

  protected canNext(): boolean {
    if (this.step() === 0) return this.handleState().state === 'available' || (!!this.portfolio().handle && this.handle === this.portfolio().handle);
    if (this.step() === 1) return this.name.trim().length > 0;
    // Photos: Next only once some went in; otherwise it's Skip, so setup never looks done when nothing was added.
    if (this.step() === 3) return !!this.firstAdded();
    return true;
  }

  protected async next(): Promise<void> {
    this.busy.set(true);
    try {
      let p: Portfolio | null = null;
      if (this.step() === 0) p = await firstValueFrom(this.api.setPortfolioHandle(this.handle));
      else if (this.step() === 1) p = await firstValueFrom(this.api.updatePortfolio({ displayName: this.name.trim(), tagline: this.tagline.trim() }));
      else if (this.step() === 2)
        p = await firstValueFrom(this.api.updatePortfolio({ theme: this.theme ?? undefined, accent: this.accent ?? undefined, font: this.font ?? undefined }));
      if (p) this.changed.emit(p);
      this.step.set(this.step() + 1);
    } catch {
      /* the toast said why */
    } finally {
      this.busy.set(false);
    }
  }

  protected async addFirst(pick: PortfolioPick): Promise<void> {
    this.busy.set(true);
    this.addError.set(null);
    try {
      const r = await firstValueFrom(this.api.addPortfolioPhotos({ photoIds: pick.photoIds, newCollectionTitle: pick.eventTitle }));
      this.changed.emit(r.portfolio);
      if (r.added > 0) this.firstAdded.set(`${r.message} They're in a collection called "${pick.eventTitle}". You can rename it later.`);
      else this.addError.set(r.message);
    } catch (e) {
      this.addError.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected async finish(publish: boolean): Promise<void> {
    this.busy.set(true);
    try {
      const p = publish
        ? await firstValueFrom(this.api.publishPortfolio(true))
        : await firstValueFrom(this.api.updatePortfolio({ setupDone: true }));
      if (publish) this.toast.success('Your portfolio is live.');
      this.finished.emit(p);
    } catch {
      /* toast */
    } finally {
      this.busy.set(false);
    }
  }
}
