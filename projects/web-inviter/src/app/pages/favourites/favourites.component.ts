import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PhotoBoxComponent } from '../../shared/photo-box/photo-box.component';

/**
 * Everything the reader hearted, from every album they can see: the album page's own grid, pinch,
 * filters (plus Event or album), selection, Share, Download and viewer, with "Remove from favourites"
 * where an album has Remove. Opened from the heart in the top bar.
 */
@Component({
  selector: 'app-favourites',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PhotoBoxComponent],
  template: `
    <section class="wrap">
      <div class="ib-container">
        <app-photo-box campaignId="" as="favourites" heading="Favourites" />
      </div>
    </section>
  `,
  styles: `
    .wrap {
      padding: clamp(1rem, 3vw, 2.5rem) 0 6rem;
    }
  `,
})
export class FavouritesComponent {}
