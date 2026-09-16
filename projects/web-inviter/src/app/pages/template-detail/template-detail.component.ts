import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiBadge } from '@zouriel/ui/badge';
import { UiText } from '@zouriel/ui/text';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { FeatureStore } from '../../shared/services/feature.store';
import { ReportTemplateComponent } from '../../shared/report-template/report-template.component';
import { ApiService } from '../../shared/api/api.service';
import { Template } from '../../shared/utils/types/api.types';
import { SafeUrlPipe } from '../../shared/pipes/safe-url.pipe';
import { SessionStore } from '../../shared/services/session.store';
import { SITE_URL, SeoService } from '../../shared/services/seo.service';
import { OCCASIONS } from '../../shared/utils/constants/occasions';

@Component({
  selector: 'app-template-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReportTemplateComponent, 
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
  private readonly route = inject(ActivatedRoute);
  protected readonly session = inject(SessionStore);
  protected readonly features = inject(FeatureStore);
  private readonly seo = inject(SeoService);

  /** Bound from route param via withComponentInputBinding. */
  readonly slug = input.required<string>();

  /**
   * Bound from the `?forEvent=` query param, the same way. When it is set the visitor already has an
   * event — named, dated, possibly with a media bucket on it — and this template attaches to that
   * one instead of creating another.
   */
  readonly forEvent = input<string | undefined>(undefined);

  /**
   * Bound from `?start=1`, which only this page's own sign-in detour sets: the visitor pressed "Use
   * this template" while signed out, signed in, and is sent back here to carry on without having to
   * find the button again.
   */
  readonly start = input<string | undefined>(undefined);

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
        this.describe(t);
        if (this.start() && this.session.isSessionValid()) {
          // Drop the flag first so a failed create, or Back from the wizard, doesn't start another.
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { start: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
          this.use();
        }
      },
      error: () => {
        this.loading.set(false);
        this.seo.set(
          { title: 'Design not found', description: 'We couldn’t find that design.', noindex: true },
          `/templates/${this.slug()}`,
        );
      },
    });
  }

  /** The occasion page for this design's category, when there is one. */
  protected occasionFor(t: Template) {
    return OCCASIONS.find((o) => o.category.toLowerCase() === t.category?.toLowerCase()) ?? null;
  }

  private describe(t: Template): void {
    const path = `/templates/${t.slug}`;
    const kind = t.category ? `${t.category.toLowerCase()} invitation` : 'invitation';
    const image = t.previewImageUrl ? SITE_URL + t.previewImageUrl : undefined;
    this.seo.set(
      {
        title: `${t.name}: animated ${kind}`,
        description:
          t.description?.trim() ||
          `${t.name} is an animated ${kind} that shows each guest their own name and details.`,
        image,
        // Made for one client and shown for inspiration only; nothing here for a searcher to use.
        noindex: !!t.isShowcase,
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'CreativeWork',
            name: t.name,
            description: t.description,
            genre: t.category,
            image,
            url: SITE_URL + path,
            creator: t.designerName ? { '@type': 'Person', name: t.designerName } : undefined,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
              { '@type': 'ListItem', position: 2, name: 'Designs', item: `${SITE_URL}/templates` },
              { '@type': 'ListItem', position: 3, name: t.name, item: SITE_URL + path },
            ],
          },
        ],
      },
      path,
    );
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
    // Creating needs an account, the same rule /events/new enforces with its guard: every event gets
    // a media bucket, and a bucket belongs to an account. Posting without a session made an event
    // nobody owned. Send them to sign in, and bring them back here to continue.
    if (!this.session.isSessionValid()) {
      const back = new URLSearchParams({ start: '1' });
      const existing = this.forEvent();
      if (existing) back.set('forEvent', existing);
      void this.router.navigate(['/login'], {
        queryParams: { next: `/templates/${encodeURIComponent(t.slug)}?${back}` },
      });
      return;
    }
    this.creating.set(true);
    const title = `${t.name} invitation`;

    const existing = this.forEvent();
    if (existing) {
      this.api.attachTemplate(existing, t.id).subscribe({
        next: () => {
          // Only the package matters here: the title belongs to the event the visitor named, and
          // overwriting it with the template's name would rename their evening after a design.
          this.api.storeMeta(existing, {
            ...this.api.getMeta(existing),
            packageUrl: t.packageUrl,
            templateName: t.name,
          });
          this.router.navigate(['/create', existing, 'roles']);
        },
        error: () => this.creating.set(false),
      });
      return;
    }

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
