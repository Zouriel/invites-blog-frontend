import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiResult } from '@zouriel/ui/feedback';
import { UiSpinner } from '@zouriel/ui/spinner';
import { ApiService } from '../../shared/api/api.service';

/**
 * An invitation you received, opened from your account. It used to be drawn here in a sandboxed
 * iframe with the data posted in; the invitation is now rendered by the server as one top-level
 * document on its own host, so this page's only job is to hand you over to it.
 *
 * The handover is a short-lived one-hop link rather than a cookie set from here, because that host
 * is a sibling — and a cookie's Domain may name the setting host or a parent, never a sibling.
 */
@Component({
  selector: 'app-invitation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButton, UiResult, UiSpinner],
  templateUrl: './invitation.component.html',
  styleUrl: './invitation.component.scss',
})
export class InvitationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);

  protected readonly failed = signal(false);
  protected readonly message = signal('');

  ngOnInit(): void {
    const campaignId = this.route.snapshot.paramMap.get('campaignId') ?? '';
    this.api.invitationRenderLink(campaignId).subscribe({
      // A full navigation, not a router hop — the invitation is served by another origin under a
      // content security policy this app must not be inside of.
      next: ({ url }) => window.location.replace(url),
      error: (err: { message?: string }) => {
        this.message.set(err?.message ?? '');
        this.failed.set(true);
      },
    });
  }

  goInbox(): void {
    void this.router.navigate(['/inbox']);
  }
}
