import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UiCard } from '@zouriel/ui/card';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import type { DesignCatalog } from './model/scene';

/**
 * `/design/new` — pick where to start. `?starter=` skips the choice; `?campaign=` remembers the event
 * this template is for, so its first publish becomes that event's invitation.
 */
@Component({
  selector: 'app-design-new',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiCard, UiSpinner, UiText],
  template: `
    <section class="wrap">
      <div class="ib-container">
        <header class="head">
          <span class="eyebrow">Template designer</span>
          <ui-text variant="h1">Design your own invitation</ui-text>
          <ui-text variant="body" class="lead">Start from a layout and make it yours — move things, animate them as guests scroll, and publish it just for you or for everyone.</ui-text>
        </header>

        @if (creating()) {
          <div class="centered"><ui-spinner /> <span>Setting up your canvas…</span></div>
        } @else if (catalog(); as c) {
          <div class="grid">
            @for (s of c.starters; track s.id) {
              <button type="button" class="starter" (click)="create(s.id)">
                <ui-card padding="sm" class="card">
                  <div class="art" [attr.data-starter]="s.id" aria-hidden="true">
                    <span class="line l1"></span><span class="line l2"></span><span class="dot"></span><span class="line l3"></span>
                  </div>
                  <div class="body">
                    <strong>{{ s.name }}</strong>
                    <span>{{ s.description }}</span>
                  </div>
                </ui-card>
              </button>
            }
          </div>
          <p class="foot">Already have a template you want to rework? Open it from <a routerLink="/my-templates" [queryParams]="{ tab: 'designer' }">My templates</a>.</p>
        } @else {
          <div class="centered"><ui-spinner /></div>
        }
      </div>
    </section>
  `,
  styles: `
    .wrap { padding: 32px 0 64px; }
    .head { display: grid; gap: 8px; max-width: 720px; margin-bottom: 28px; }
    .eyebrow { font: 600 12px var(--ui-font-default); letter-spacing: .08em; text-transform: uppercase; color: var(--ui-color-text-muted); }
    .lead { color: var(--ui-color-text-secondary); }
    .card { --pad-reset: 1; }
    .centered { display: flex; gap: 10px; align-items: center; justify-content: center; min-height: 240px; color: var(--ui-color-text-muted); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px; }
    .starter { padding: 0; border: 0; background: none; text-align: left; cursor: pointer; font: inherit; color: inherit; border-radius: var(--ui-radius-lg); }
    .starter:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .starter:hover .card { transform: translateY(-2px); }
    .card { display: block; overflow: hidden; transition: transform var(--ui-motion-base) var(--ui-ease-standard); }
    .art { position: relative; aspect-ratio: 4 / 5; display: grid; place-content: center; gap: 12px; justify-items: center; background: var(--ui-gradient-frost); }
    .art[data-starter="wedding"] { background: linear-gradient(160deg, #fbf7f0, #e9dcc4); }
    .art[data-starter="birthday"] { background: linear-gradient(160deg, #1d1a3a, #ff5d73); }
    .art[data-starter="save-the-date"] { background: linear-gradient(160deg, #f3eed8, #1b3d59); }
    .line { display: block; height: 8px; border-radius: 4px; background: color-mix(in srgb, currentColor 40%, transparent); color: var(--ui-color-text); }
    .l1 { width: 120px; height: 14px; } .l2 { width: 80px; } .l3 { width: 100px; }
    .dot { width: 44px; height: 44px; border-radius: 50%; background: color-mix(in srgb, var(--ui-color-text) 25%, transparent); }
    .body { display: grid; gap: 4px; padding: 14px 16px 18px; }
    .body span { color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
    @media (max-width: 560px) {
      .wrap { padding: 16px 0 96px; }
      .head { margin-bottom: 18px; }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .art { gap: 8px; }
      .l1 { width: 60%; height: 10px; } .l2 { width: 40%; } .l3 { width: 50%; }
      .dot { width: 30px; height: 30px; }
      .body { padding: 10px 12px 12px; }
    }
    .foot { margin-top: 28px; color: var(--ui-color-text-muted); }
  `,
})
export class DesignNewComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly catalog = signal<DesignCatalog | null>(null);
  protected readonly creating = signal(false);

  constructor() {
    const starter = this.route.snapshot.queryParamMap.get('starter');
    if (starter) void this.create(starter);
    else firstValueFrom(this.api.designCatalog()).then((c) => this.catalog.set(c)).catch(() => undefined);
  }

  protected async create(starter: string): Promise<void> {
    this.creating.set(true);
    try {
      const campaignId = this.route.snapshot.queryParamMap.get('campaign');
      const design = await firstValueFrom(this.api.createDesign({ starter, campaignId }));
      await this.router.navigate(['/design', design.id], { replaceUrl: true });
    } catch {
      this.creating.set(false);
    }
  }
}
