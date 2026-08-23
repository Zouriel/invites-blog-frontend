import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiBadge } from '@zouriel/ui/badge';
import { UiText } from '@zouriel/ui/text';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { ApiService } from '../../shared/api/api.service';
import { Template } from '../../shared/utils/types/api.types';
import { SafeUrlPipe } from '../../shared/pipes/safe-url.pipe';

@Component({
  selector: 'app-template-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    UiButton,
    UiCard,
    UiBadge,
    UiText,
    UiSpinner,
    UiEmptyState,
    SafeUrlPipe,
  ],
  templateUrl: './template-detail.component.html',
  styleUrl: './template-detail.component.scss',
})
export class TemplateDetailComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  /** Bound from route param via withComponentInputBinding. */
  readonly slug = input.required<string>();

  protected readonly template = signal<Template | null>(null);
  protected readonly loading = signal(true);
  protected readonly creating = signal(false);
  protected readonly roles = signal<string[]>([]);

  ngOnInit(): void {
    this.api.getTemplate(this.slug()).subscribe({
      next: (t) => {
        this.template.set(t);
        this.loading.set(false);
        this.parseRoles(t);
      },
      error: () => this.loading.set(false),
    });
  }

  private parseRoles(t: Template): void {
    if (!t.manifestJson) {
      return;
    }
    try {
      const manifest = JSON.parse(t.manifestJson) as { roles?: string[] };
      if (Array.isArray(manifest.roles)) {
        this.roles.set(manifest.roles);
      }
    } catch {
      /* ignore malformed manifest */
    }
  }

  protected use(): void {
    const t = this.template();
    if (!t || t.isShowcase || this.creating()) {
      return; // showcase (used dedicated) templates are view-only
    }
    this.creating.set(true);
    const title = `${t.name} invitation`;
    this.api.createCampaign(t.id, title).subscribe({
      next: (res) => {
        this.api.storeToken(res.campaignId, res.accessToken);
        this.api.storeMeta(res.campaignId, {
          packageUrl: t.packageUrl,
          templateName: t.name,
          title,
        });
        // The wizard now opens on Roles — theming and content are both scoped per role.
        this.router.navigate(['/create', res.campaignId, 'roles']);
      },
      error: () => this.creating.set(false),
    });
  }
}
