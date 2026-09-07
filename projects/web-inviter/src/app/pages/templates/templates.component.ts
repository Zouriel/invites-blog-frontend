import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { UiContainer } from '@zouriel/ui/layout';
import { UiText } from '@zouriel/ui/text';
import { UiSectionLabel } from '@zouriel/ui/fx';
import { TemplateGalleryComponent } from '../../shared/template-gallery/template-gallery.component';

/**
 * The gallery.
 *
 * Templates are the product, and until now the only way to browse them was an auto-scrolling row on
 * the landing page — fine as a teaser, but you cannot scan a moving target, filter it, or link
 * someone to it. This is the page that does those jobs.
 *
 * The chosen category lives in the URL (?category=Wedding), so a filtered gallery is a link you can
 * send someone and a state that survives a refresh.
 */
@Component({
  selector: 'app-templates',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiContainer, UiText, UiSectionLabel, TemplateGalleryComponent],
  templateUrl: './templates.component.html',
  styleUrl: './templates.component.scss',
})
export class TemplatesComponent {
  private readonly route = inject(ActivatedRoute);

  /** Only for the line under the headline; the grid reads it for itself. */
  protected readonly forEvent = toSignal<string | null>(
    this.route.queryParamMap.pipe(map((p) => p.get('forEvent'))),
    { initialValue: null },
  );
}
