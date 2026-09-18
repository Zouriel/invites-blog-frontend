import { HugeiconsIconComponent } from '@hugeicons/angular';
import { ICONS } from './designer-icons';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiDeviceFrame } from '@zouriel/ui/media';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiCheckbox } from '@zouriel/ui/form';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../shared/api/api.service';
import { environment } from '../../../environments/environment';
import type { DesignDetail } from './model/scene';
import { renderPreview, type SampleMode } from './render';

/**
 * `/design/:id/preview` — the saved design at full size in a phone, scrolling for real. Toggle the
 * two situations the template guide says to test: fields left empty, and a guest in two roles.
 */
@Component({
  selector: 'app-design-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, FormsModule, RouterLink, UiButton, UiSegmented, UiDeviceFrame, UiSpinner, UiCheckbox],
  template: `
    <div class="page">
      <header class="bar">
        <a [routerLink]="['/design', id]"><ui-button size="sm" variant="ghost"><hugeicons-icon [icon]="icons.goBack" [size]="16" [strokeWidth]="1.8" /> Back to editing</ui-button></a>
        <strong class="name">{{ design()?.name }}</strong>
        <span class="spacer"></span>
        <ui-segmented size="sm" label="Preview with" [options]="samples" [value]="sample()" (valueChange)="sample.set($event ?? 'filled')" />
        @for (b of blocks(); track b) {
          <ui-checkbox class="block" [ngModel]="!hiddenBlocks().has(b)" (ngModelChange)="toggleBlock(b)">{{ b }}</ui-checkbox>
        }
      </header>
      <div class="phone">
        @if (html(); as h) {
          <ui-device-frame [width]="390" [height]="844" [maxScale]="1">
            <iframe class="frame" sandbox="allow-scripts allow-popups" [srcdoc]="h" title="Invitation preview"></iframe>
          </ui-device-frame>
        } @else {
          <ui-spinner />
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; height: 100dvh; background: var(--ui-color-surface-subtle); }
    .page { height: 100%; display: grid; grid-template-rows: auto 1fr; }
    .bar { display: flex; align-items: center; gap: 12px; padding: 8px 14px; background: var(--ui-color-surface); border-bottom: 1px solid var(--ui-color-border); flex-wrap: wrap; }
    .bar a { text-decoration: none; }
    .spacer { flex: 1; }
    .block { display: flex; align-items: center; gap: 6px; font-size: 13px; }
    .phone { min-height: 0; display: grid; place-items: center; padding: 18px; }
    .frame { display: block; width: 100%; height: 100%; border: 0; background: #fff; }
  `,
})
export class DesignPreviewComponent {
  protected readonly icons = ICONS;
  private readonly api = inject(ApiService);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;

  private readonly catalog = firstValueFrom(this.api.designCatalog());
  protected readonly design = signal<DesignDetail | null>(null);
  protected readonly html = signal<SafeHtml | null>(null);
  protected readonly sample = signal('filled');
  protected readonly hiddenBlocks = signal<ReadonlySet<string>>(new Set());
  protected readonly samples = [{ value: 'filled', label: 'Filled' }, { value: 'empty', label: 'Empty fields' }, { value: 'roles', label: 'Two roles' }];

  protected readonly blocks = computed(() => {
    const scene = this.design()?.scene;
    if (!scene) return [];
    const found = new Set<string>();
    const walk = (list: DesignDetail['scene']['elements']) => list.forEach((e) => { if (e.block) found.add(e.block); if (e.children) walk(e.children); });
    walk(scene.elements);
    return [...found];
  });

  constructor() {
    firstValueFrom(this.api.getDesign(this.id)).then((d) => this.design.set(d)).catch(() => undefined);
    effect(() => {
      const design = this.design();
      const sample = this.sample();
      const hidden = this.hiddenBlocks();
      if (!design) return;
      untracked(() => void this.render(design, sample, hidden));
    });
  }

  protected toggleBlock(block: string): void {
    this.hiddenBlocks.update((set) => {
      const next = new Set(set);
      if (next.has(block)) next.delete(block);
      else next.add(block);
      return next;
    });
  }

  private async render(design: DesignDetail, sample: string, hidden: ReadonlySet<string>): Promise<void> {
    this.html.set(null);
    const blocks = this.blocks().filter((b) => !hidden.has(b));
    let html: string;
    try {
      // Rendered in the browser, like the editor's preview; the server's is the fallback.
      const catalog = await this.catalog;
      html = renderPreview(design.scene, catalog, {
        fontBaseUrl: catalog.fontBaseUrl, sample: sample as SampleMode, blocks, editor: false,
      }).html;
    } catch {
      html = (await firstValueFrom(this.api.previewDesign({ scene: design.scene, sample, blocks, editor: false }))).html;
    }
    const base = environment.assetsBase.replace(/\/$/, '');
    if (base.startsWith('http')) html = html.replaceAll('url("/assets/', `url("${base}/`);
    // Angular would sanitise a bound srcdoc down to bare text, dropping the template's styles and
    // motion. This is the design's own compiled page, and the frame is sandboxed without
    // allow-same-origin, so it runs on an opaque origin that can't reach this page.
    this.html.set(this.sanitizer.bypassSecurityTrustHtml(html));
  }
}
