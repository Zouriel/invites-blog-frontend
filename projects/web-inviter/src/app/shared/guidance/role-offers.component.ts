import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { UiAvatar } from '@zouriel/ui/badge';
import { UiOfferCard } from '@zouriel/ui/guidance';
import { GuidanceService } from './guidance.service';
import { GuidanceNewRole } from './guidance.types';

/** The celebrant card's words (docs/GUIDANCE.md section 4, offer.role). */
export function roleHeading(r: Pick<GuidanceNewRole, 'addedBy' | 'title'>): string {
  return `${r.addedBy || 'Someone'} added you to “${r.title}” as a celebrant.`;
}
export function roleBody(access: 'look' | 'full'): string {
  return access === 'full' ? 'You can manage it with them.' : "You can see who's coming and all the photos.";
}

/**
 * "X added you to their event as a celebrant": one card per new role, at the top of Feed and Inbox.
 * Answering it (opening the event, the tour, or the ×) acknowledges the role, so it shows nowhere
 * after. Hidden while tips are off.
 */
@Component({
  selector: 'app-role-offers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiAvatar, UiOfferCard],
  template: `
    @if (roles().length) {
      <div class="roles">
        @for (r of roles(); track r.campaignId) {
          <ui-offer-card
            variant="role"
            [heading]="heading(r)"
            [body]="body(r.access)"
            primaryLabel="Open event"
            secondaryLabel="Show me around"
            (primaryClick)="open(r, false)"
            (secondaryClick)="open(r, true)"
            (dismissed)="close(r)"
          >
            <!-- One root element per branch: that is how a control-flow block reaches a named slot. -->
            @if (r.coverUrl) {
              <img offer-art [src]="r.coverUrl" alt="" />
            } @else {
              <ui-avatar offer-art [name]="r.title" size="lg" />
            }
          </ui-offer-card>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .roles { display: grid; gap: 0.75rem; margin-bottom: 1.25rem; }
  `,
})
export class RoleOffersComponent {
  private readonly guidance = inject(GuidanceService);
  private readonly router = inject(Router);

  protected readonly roles = computed(() =>
    this.guidance.loaded() && this.guidance.tipsOn() ? this.guidance.newRoles() : [],
  );
  protected readonly heading = roleHeading;
  protected readonly body = roleBody;

  protected open(r: GuidanceNewRole, tour: boolean): void {
    this.guidance.ackRole(r.campaignId);
    void this.router.navigate(['/dashboard', r.campaignId], tour ? { queryParams: { tour: 'celebrant' } } : {});
  }

  protected close(r: GuidanceNewRole): void {
    this.guidance.ackRole(r.campaignId);
  }
}
