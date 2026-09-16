import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UiButton } from '@zouriel/ui/button';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiSpinner } from '@zouriel/ui/spinner';
import { ApiService } from '../../shared/api/api.service';
import { environment } from '../../../environments/environment';
import type { DesignScene } from './model/scene';

/**
 * `/design/import/:templateId` — opens an existing template in the designer.
 *
 * <p>A template made in the designer opens exactly. A hand-written one is converted: the server
 * binds it with sample data and adds an extractor script; it runs here, in a hidden sandboxed frame
 * at phone size, measures what it renders while scrolling through, and hands back a scene. The
 * frame is opaque-origin, so the template's own JavaScript runs but can't reach this page — its
 * answer is only data, and the server validates it like any other scene.</p>
 */
@Component({
  selector: 'app-design-import',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButton, UiEmptyState, UiSpinner],
  template: `
    @if (error(); as e) {
      <div class="center">
        <ui-empty-state heading="This template couldn't be opened in the designer" [description]="e">
          <div empty-actions><a routerLink="/my-templates" [queryParams]="{ tab: 'designer' }"><ui-button variant="primary">Back to my templates</ui-button></a></div>
        </ui-empty-state>
      </div>
    } @else {
      <div class="center">
        <ui-spinner />
        <p>{{ status() }}</p>
      </div>
    }
    <iframe #frame class="probe" sandbox="allow-scripts" title="Converting template" aria-hidden="true" tabindex="-1"></iframe>
  `,
  styles: `
    :host { display: block; min-height: 100dvh; position: relative; }
    /* The cover sits over the probe. The probe stays ON screen: a browser throttles rendering in frames
       it thinks nobody can see, and scroll-driven animation only advances when the frame renders. */
    .center { position: relative; z-index: 2; min-height: 100dvh; display: grid; place-content: center; justify-items: center; gap: 12px;
      color: var(--ui-color-text-muted); text-align: center; padding: 24px; background: var(--ui-color-bg); }
    .probe { position: fixed; left: 0; top: 0; z-index: 1; width: 390px; height: 844px; border: 0; pointer-events: none; }
  `,
})
export class DesignImportComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly frame = viewChild.required<ElementRef<HTMLIFrameElement>>('frame');

  protected readonly status = signal('Opening the template…');
  protected readonly error = signal<string | null>(null);

  constructor() {
    const destroy = inject(DestroyRef);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onMessage = async (e: MessageEvent) => {
      if (e.source !== this.frame().nativeElement.contentWindow) return;
      const data = e.data as { type?: string; scene?: DesignScene; error?: string; progress?: string };
      if (data?.type === 'ib:import-progress' && data.progress) this.status.set(data.progress);
      if (data?.type !== 'ib:import') return;
      if (timer) clearTimeout(timer);
      if (!data.scene) {
        this.error.set(data.error ?? 'The template could not be read.');
        return;
      }
      this.status.set('Saving the converted design…');
      try {
        const design = await firstValueFrom(this.api.createDesign({ fromTemplateId: this.templateId, scene: data.scene }));
        await this.router.navigate(['/design', design.id], { replaceUrl: true, queryParams: { imported: 1 } });
      } catch (err) {
        this.error.set((err as Error).message);
      }
    };
    window.addEventListener('message', onMessage);
    destroy.onDestroy(() => {
      window.removeEventListener('message', onMessage);
      if (timer) clearTimeout(timer);
    });

    void this.start((t) => (timer = t));
  }

  private get templateId(): string {
    return this.route.snapshot.paramMap.get('templateId')!;
  }

  private async start(setTimer: (t: ReturnType<typeof setTimeout>) => void): Promise<void> {
    try {
      const source = await firstValueFrom(this.api.designImportSource(this.templateId));
      if (source.existingDesignId) {
        await this.router.navigate(['/design', source.existingDesignId], { replaceUrl: true });
        return;
      }
      if (source.designed) {
        const design = await firstValueFrom(this.api.createDesign({ fromTemplateId: this.templateId }));
        await this.router.navigate(['/design', design.id], { replaceUrl: true });
        return;
      }
      this.status.set(`Converting “${source.name}”…`);
      const base = environment.assetsBase.replace(/\/$/, '');
      const html = base.startsWith('http') ? (source.html ?? '').replaceAll('"/assets/', `"${base}/`).replaceAll("'/assets/", `'${base}/`) : source.html ?? '';
      this.frame().nativeElement.srcdoc = html;
      setTimer(setTimeout(() => this.error.set('Converting took too long. The template may rely on something the designer can’t read.'), 45000));
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
}
