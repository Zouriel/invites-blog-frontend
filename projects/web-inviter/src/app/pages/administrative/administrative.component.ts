import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import { UiText } from '@zouriel/ui/text';
import { AdminTemplatesComponent } from '../admin-templates/admin-templates.component';
import { AdminTemplateReportsComponent } from '../admin-template-reports/admin-template-reports.component';

/** The tabs, in the order they read. First is spelled as the absence of the parameter. */
export const ADMIN_TABS = ['templates', 'reports'] as const;

/** Tabs that moved to Settings; old links to them are sent on. */
const MOVED_TO_SETTINGS = ['designers'];
export type AdminTab = (typeof ADMIN_TABS)[number];

/**
 * The platform's own work, in one place.
 *
 * <p>System templates and reports on published templates are one job — looking after the gallery —
 * so they are tabs of one page rather than separate destinations.</p>
 *
 * <p>Each is still its own component: this page owns the chrome and the tabs, and each panel owns
 * its own data and its own dialogs. Settings and Inquiries stay separate on purpose — one is
 * configuration (including the designers list, which is about people rather than the gallery) and the other is a queue with a detail page behind it.</p>
 */
@Component({
  selector: 'app-administrative',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UiTab, UiTabs, UiText,
    AdminTemplatesComponent, AdminTemplateReportsComponent,
  ],
  templateUrl: './administrative.component.html',
  styleUrl: './administrative.component.scss',
})
export class AdministrativeComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  constructor() {
    const named = this.route.snapshot.queryParamMap.get('tab');
    if (named && MOVED_TO_SETTINGS.includes(named))
      void this.router.navigate(['/admin/settings'], { queryParams: { tab: named }, replaceUrl: true });
  }

  /**
   * Which tab is open, DERIVED from the URL rather than held beside it.
   *
   * <p>The same shape as the other tabbed screens: the address bar is the one answer, so a refresh
   * and a shared link both land where they should, and nothing has to be kept in step.</p>
   */
  protected readonly tab = computed(() => {
    const named = this.params().get('tab') as AdminTab | null;
    const at = named ? ADMIN_TABS.indexOf(named) : 0;
    return at < 0 ? 0 : at;
  });

  protected onTabChange(index: number): void {
    const key = ADMIN_TABS[index] ?? ADMIN_TABS[0];
    void this.router.navigate([], {
      relativeTo: this.route,
      // The first tab is the absence of the parameter, so the plain URL is never a redirect.
      queryParams: { tab: index === 0 ? null : key },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
