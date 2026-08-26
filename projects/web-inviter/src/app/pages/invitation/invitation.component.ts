import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiResult } from '@zouriel/ui/feedback';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { PhotoBoxComponent } from '../../shared/photo-box/photo-box.component';

/**
 * An event you were invited to, opened from your invitations.
 *
 * <p><b>This used to hand straight over to the invitation itself</b> — it fetched a one-hop link and
 * replaced the location with it. That is the right destination on the day and the wrong one for the
 * rest of the year: an invitation is read once, and afterwards what people come back for is the
 * photographs. So the photos are the page, and the invitation is a button above them.</p>
 *
 * <p>The handover is still a full navigation to a one-hop link, not a router hop: the invitation is
 * served by a sibling host under a content security policy this app must not be inside of, and a
 * cookie's Domain may name the setting host or a parent, never a sibling.</p>
 */
@Component({
  selector: 'app-invitation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PhotoBoxComponent, UiButton, UiResult, UiSpinner, UiText],
  templateUrl: './invitation.component.html',
  styleUrl: './invitation.component.scss',
})
export class InvitationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);

  protected readonly campaignId = signal('');
  protected readonly title = signal('');
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly message = signal('');

  /** True while the one-hop link is being fetched, so the button can say it is working. */
  protected readonly opening = signal(false);

  ngOnInit(): void {
    const campaignId = this.route.snapshot.paramMap.get('campaignId') ?? '';
    this.campaignId.set(campaignId);

    // The photo box loads itself; this only needs enough to name the event and to prove the caller
    // is on its guest list — the same check that gates the photos underneath.
    this.api.invitationPhotos(campaignId).subscribe({
      next: (box) => {
        this.title.set(box.eventTitle);
        this.loading.set(false);
      },
      error: (err: { message?: string }) => {
        this.message.set(err?.message ?? '');
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  /** Opens the invitation itself, on the host that renders it. */
  protected openInvitation(): void {
    this.opening.set(true);
    this.api.invitationRenderLink(this.campaignId()).subscribe({
      next: ({ url }) => window.location.replace(url),
      error: (err: { message?: string }) => {
        this.message.set(err?.message ?? '');
        this.opening.set(false);
      },
    });
  }

  protected goInbox(): void {
    void this.router.navigate(['/inbox']);
  }
}
