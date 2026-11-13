import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api/api.service';

/**
 * "View invite": opens the invitation exactly as a guest sees it, read-only (no reply recorded, no view
 * counted), in a new tab. The server mints a two-minute, one-hop link after checking who is asking.
 *
 * The tab is opened at the click, before the link arrives, so a popup blocker lets it through; it is cut off
 * from this page (`opener = null`) because the invitation may run a design's own script.
 */
@Injectable({ providedIn: 'root' })
export class InvitePreviewService {
  private readonly api = inject(ApiService);

  open(campaignId: string): void {
    const tab = typeof window === 'undefined' ? null : window.open('', '_blank');
    if (tab) tab.opener = null;
    this.api.previewLink(campaignId).subscribe({
      next: ({ url }) => {
        if (tab && !tab.closed) tab.location.href = url;
        else window.location.href = url;
      },
      // The API has already shown the server's reason as a toast; just don't leave a blank tab behind.
      error: () => tab?.close(),
    });
  }
}
