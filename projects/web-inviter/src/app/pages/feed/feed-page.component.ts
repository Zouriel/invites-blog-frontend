import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FeedComponent } from './feed.component';

/** Where a signed-in person lands: every event they're part of, as posts. */
@Component({
  selector: 'app-feed-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FeedComponent],
  template: `
    <section class="wrap">
      <div class="ib-container"><app-feed /></div>
    </section>
  `,
  styles: `
    /* Posts bleed their photos to the screen edge with 50vw, which counts a desktop scrollbar; clip
       the few pixels that makes, or a narrow desktop window scrolls sideways. */
    .wrap {
      padding: clamp(1rem, 3vw, 2.5rem) 0 4rem;
      overflow-x: clip;
    }
  `,
})
export class FeedPageComponent {}
