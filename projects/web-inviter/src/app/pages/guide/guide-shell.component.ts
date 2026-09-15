import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { UiSelect, UiSelectOption } from '@zouriel/ui/form';
import { UiSideNav, UiSideNavGroup, UiSideNavItem } from '@zouriel/ui/navigation';
import { filter } from 'rxjs';
import { GUIDE_GROUPS, GUIDES, Guide, guideBySlug } from './guides';

/**
 * The help centre: every guide beside a list of all of them.
 *
 * <p>On a wide screen the list is a sticky side navigation; on a phone, where a second column does
 * not fit, it is a sticky dropdown above the guide. Both navigate to the guide's own URL, so Back
 * works and a guide can be linked to. The side navigation renders real links, so crawlers of the
 * prerendered pages can follow them.</p>
 *
 * <p>The heading, the lead and the previous/next links come from {@link GUIDES}; each guide's
 * component is only its body.</p>
 */
@Component({
  selector: 'app-guide-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, RouterOutlet, UiSelect, UiSideNav],
  templateUrl: './guide-shell.component.html',
  styleUrl: './guide-shell.component.scss',
})
export class GuideShellComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** The open guide's slug, or '' on the overview. */
  protected readonly slug = signal(this.childPath());

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.slug.set(this.childPath()));
  }

  protected readonly guide = computed<Guide | undefined>(() => guideBySlug(this.slug()));

  protected readonly navGroups: UiSideNavGroup[] = [
    { items: [{ label: 'All guides', value: '', href: '/guide' }] },
    ...GUIDE_GROUPS.map((group) => ({
      label: group,
      items: GUIDES.filter((g) => g.group === group).map((g) => ({
        label: g.title,
        value: g.slug,
        href: `/guide/${g.slug}`,
      })),
    })),
  ];

  protected readonly selectOptions: UiSelectOption[] = [
    { label: 'All guides', value: '' },
    ...GUIDES.map((g) => ({ label: `${g.title} · ${g.group}`, value: g.slug })),
  ];

  private readonly index = computed(() => GUIDES.findIndex((g) => g.slug === this.slug()));

  /** On the overview, "next" is the first guide; there is no previous. */
  protected readonly previous = computed(() => (this.index() > 0 ? GUIDES[this.index() - 1] : null));
  protected readonly next = computed(() => GUIDES[this.index() + 1] ?? null);

  protected onNavigate(item: UiSideNavItem): void {
    this.go(item.value);
  }

  protected go(slug: string): void {
    if (slug === this.slug()) return;
    void this.router.navigateByUrl(slug ? `/guide/${slug}` : '/guide');
  }

  private childPath(): string {
    return this.route.snapshot.firstChild?.routeConfig?.path ?? '';
  }
}
