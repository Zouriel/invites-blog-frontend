import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UiAccordion, UiAccordionItem } from 'ui/accordion';
import { UiAlert } from 'ui/alert';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiEmptyState } from 'ui/feedback';
import { UiColorPicker, UiFormField, UiInput, UiSelect } from 'ui/form';
import { UiSpinner } from 'ui/spinner';
import { UiText } from 'ui/text';
import { ApiService } from '../../shared/api/api.service';
import {
  RoleDefinition,
  TemplateManifest,
  TemplateThemeKey,
  ThemeOverrides,
} from '../../shared/utils/types/api.types';
import { WizardStepsComponent } from '../../features/wizard/wizard-steps.component';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';

/**
 * Theming step (between Roles and Content). The template declares its palette as `--ib-*` custom
 * properties; this renders one real control per declared key, pre-filled with the template's own
 * default. Everyone gets the shared values unless a role is opened and overridden, so the common
 * case stays one screen of colour pickers.
 *
 * Persisted role-keyed on `themeOverridesJson` as `{ shared, roles }` — the renderer layers a
 * guest's role over shared, and anything left untouched simply isn't stored and falls back to the
 * template's own default.
 */
@Component({
  selector: 'app-theming',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, UiAccordion, UiAccordionItem, UiAlert, UiButton, UiCard, UiColorPicker,
    UiEmptyState, UiFormField, UiInput, UiSelect, UiSpinner, UiText, WizardStepsComponent,
  ],
  templateUrl: './theming.component.html',
  styleUrl: './theming.component.scss',
})
export class ThemingComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly campaignId = input.required<string>();
  protected readonly stepKey = WizardStepKey.Theming;

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);

  protected readonly themeKeys = signal<TemplateThemeKey[]>([]);
  protected readonly fonts = signal<string[]>([]);
  /** The roles the inviter named in the previous step. */
  protected readonly roles = signal<string[]>([]);

  protected readonly shared = signal<Record<string, string>>({});
  protected readonly byRole = signal<Record<string, Record<string, string>>>({});

  protected readonly hasTheme = computed(() => this.themeKeys().length > 0);
  protected readonly fontOptions = computed(() =>
    this.fonts().map((f) => ({ label: f, value: f })),
  );

  ngOnInit(): void {
    this.api.getCampaignSummary(this.campaignId()).subscribe({
      next: (summary) => {
        const manifest = this.parse<TemplateManifest>(summary.template?.manifestJson) ?? {};
        this.themeKeys.set(manifest.theme?.keys ?? []);
        this.fonts.set(manifest.theme?.fonts ?? []);

        const saved = this.parse<ThemeOverrides>(summary.themeOverridesJson) ?? {};
        this.shared.set({ ...(saved.shared ?? {}) });
        this.byRole.set({ ...(saved.roles ?? {}) });

        const named = this.parse<{ roles?: RoleDefinition[] }>(summary.rolesJson)?.roles ?? [];
        this.roles.set(named.map((r) => r.name).filter((n) => !!n?.trim()));

        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** The value a control shows: the saved override, else the template's authored default. */
  protected sharedValue(key: TemplateThemeKey): string {
    return this.shared()[key.key] ?? key.default;
  }

  protected roleValue(role: string, key: TemplateThemeKey): string {
    return this.byRole()[role]?.[key.key] ?? this.sharedValue(key);
  }

  protected setShared(key: TemplateThemeKey, value: string): void {
    this.shared.update((m) => ({ ...m, [key.key]: value }));
  }

  protected setForRole(role: string, key: TemplateThemeKey, value: string): void {
    this.byRole.update((m) => ({ ...m, [role]: { ...(m[role] ?? {}), [key.key]: value } }));
  }

  /** Drops a role's overrides so it goes back to following the shared values. */
  protected resetRole(role: string): void {
    this.byRole.update((m) => {
      const next = { ...m };
      delete next[role];
      return next;
    });
  }

  protected isOverridden(role: string): boolean {
    return Object.keys(this.byRole()[role] ?? {}).length > 0;
  }

  protected saveDraft(): void {
    this.persist(false);
  }

  protected next(): void {
    this.persist(true);
  }

  protected skip(): void {
    void this.router.navigate(['/create', this.campaignId(), 'editor']);
  }

  private persist(advance: boolean): void {
    this.saving.set(true);
    // Only keys the inviter actually changed are stored; the rest fall back to the template's default.
    const overrides: ThemeOverrides = {
      shared: this.prune(this.shared()),
      roles: Object.fromEntries(
        Object.entries(this.byRole())
          .map(([role, values]) => [role, this.prune(values)] as const)
          .filter(([, values]) => Object.keys(values).length > 0),
      ),
    };

    this.api
      .saveContent(this.campaignId(), { themeOverridesJson: JSON.stringify(overrides) })
      .subscribe({
        next: () => {
          this.saving.set(false);
          if (advance) this.skip();
        },
        error: () => this.saving.set(false),
      });
  }

  /** Strips values equal to the template's own default — storing them would freeze today's palette. */
  private prune(values: Record<string, string>): Record<string, string> {
    const defaults = new Map(this.themeKeys().map((k) => [k.key, k.default]));
    return Object.fromEntries(
      Object.entries(values).filter(([key, value]) => !!value && value !== defaults.get(key)),
    );
  }

  private parse<T>(json: string | undefined): T | null {
    if (!json) return null;
    try {
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  }
}
