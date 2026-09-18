import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router } from '@angular/router';
import { UiButton, UiIconButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiText } from '@zouriel/ui/text';
import { UiCheckboxGroup, UiCheckboxOption, UiColorPicker, UiFormField, UiInput } from '@zouriel/ui/form';
import { isHex, shadesOf } from '../../shared/utils/colors';
import { ApiService } from '../../shared/api/api.service';
import { RoleDefinition } from '../../shared/utils/types/api.types';
import { WizardStepsComponent } from '../../features/wizard/wizard-steps.component';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';
import { wizardStepEyebrow } from '../../shared/utils/constants/app.constants';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { APP_ICONS } from '../../shared/icons/app-icons';

/** Shape of the parsed template manifest (only the parts this step needs). */
type TemplateManifest = {
  contentBlocks?: string[];
  roles?: string[];
  roleDefinitions?: { slug: string; label: string }[];
  theme?: { keys?: unknown[] };
};
/** Shape of the persisted rolesJson blob. */
type RolesBlob = { roles?: RoleDefinition[] };
/** One role's reactive form group. */
type RoleGroup = FormGroup<{
  name: FormControl<string>;
  contentBlocks: FormControl<string[]>;
  palette: FormControl<string[]>;
}>;

/**
 * Roles — the wizard's FIRST step, because both theming and content are scoped per role. The inviter
 * decides how many roles this invitation needs and names them; a template that declares roles of its
 * own pre-fills them, and one role is the normal case. Each role also maps to the template's content
 * blocks, which is what a guest actually sees. Reads the campaign summary on init and PUTs setRoles.
 */
@Component({
  selector: 'app-roles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, UiIconButton,
    FormsModule,
    ReactiveFormsModule,
    UiColorPicker,
    UiButton,
    UiCard,
    UiText,
    UiFormField,
    UiInput,
    UiCheckboxGroup,
    WizardStepsComponent,
  ],
  template: `
    <section class="wrap">
      <div class="ib-container ib-container--narrow">
        <app-wizard-steps [active]="stepKey" [campaignId]="campaignId()" />
        <header class="head">
          <span class="eyebrow">{{ eyebrow }}</span>
          <ui-text variant="h1">Who are you inviting?</ui-text>
          <ui-text variant="body" class="lead">
            Give your guests a role. Most events only need one, so we've started you with "Guests".
            Add more if some people should see different details, like family or the bridal party.
          </ui-text>
        </header>

        <ui-card padding="lg" [formGroup]="form">
          <div class="roles" formArrayName="roles">
            @for (role of roles.controls; track role; let i = $index) {
              <div class="role" [formGroupName]="i">
                <div class="role__head">
                  <ui-form-field label="Role name" class="role__name">
                    <ui-input formControlName="name" placeholder="e.g. Guests" />
                  </ui-form-field>
                  <ui-icon-button size="sm" label="Remove role" (click)="removeRole(i)"><hugeicons-icon [icon]="appIcons.remove" [size]="16" [strokeWidth]="1.8" /></ui-icon-button>
                </div>

                <button type="button" class="more" (click)="toggleMore(i)" [attr.aria-expanded]="isOpen(i)">
                  {{ isOpen(i) ? 'Fewer options' : 'More options' }} <hugeicons-icon [icon]="isOpen(i) ? appIcons.up : appIcons.down" [size]="14" [strokeWidth]="1.8" />
                </button>

                @if (isOpen(i)) {
                @if (hasBlocks()) {
                  <ui-form-field
                    label="Sections this role sees"
                    hint="Tick the sections meant only for this role. Anything left unticked by every
                          role is shown to everyone."
                  >
                    <ui-checkbox-group
                      formControlName="contentBlocks"
                      [options]="blockOptions()"
                      [selectAll]="blockOptions().length > 1"
                      selectAllLabel="All sections"
                      orientation="horizontal"
                    />
                  </ui-form-field>
                }

                <!-- Dress colours. One colour in, four shades out, every shade still editable: some
                     hosts want four different options, some want the same colour four ways. -->
                <div class="palette">
                  <span class="palette__label">Dress colours <span class="palette__opt">(optional)</span></span>
                  <p class="palette__hint">
                    Pick a colour and we'll suggest four shades of it. Change any of them if you like.
                    Guests with this role see these colours on their invitation.
                  </p>
                  <div class="palette__main">
                    <ui-color-picker
                      [ngModel]="mainColour(i)"
                      (ngModelChange)="suggestShades(i, $event)"
                      [ngModelOptions]="{ standalone: true }"
                      [swatches]="[]"
                    />
                    @if (role.controls.palette.value.length) {
                      <ui-button variant="ghost" size="sm" (click)="clearPalette(i)">Remove colours</ui-button>
                    }
                  </div>
                  @if (role.controls.palette.value.length) {
                    <div class="palette__shades">
                      @for (c of role.controls.palette.value; track $index; let j = $index) {
                        <ui-color-picker
                          [ngModel]="c"
                          (ngModelChange)="setShade(i, j, $event)"
                          [ngModelOptions]="{ standalone: true }"
                          [swatches]="[]"
                        />
                      }
                    </div>
                  }
                </div>
                }
              </div>
            }
          </div>

          <div class="roles__actions">
            <ui-button variant="outline" (click)="addRole()"><hugeicons-icon [icon]="appIcons.add" [size]="16" [strokeWidth]="1.8" /> Add a role</ui-button>
            @if (suggestions().length) {
              <div class="suggest">
                <span class="suggest__label">This design suggests:</span>
                @for (s of suggestions(); track s) {
                  <ui-button variant="ghost" size="sm" (click)="addRole(s)"><hugeicons-icon [icon]="appIcons.add" [size]="14" [strokeWidth]="1.8" /> {{ s }}</ui-button>
                }
              </div>
            }
          </div>
        </ui-card>

        <div class="actions">
          <ui-button
            variant="primary"
            [loading]="saving()"
            [disabled]="!hasNamedRole()"
            (click)="continueToTheming()"
          >
            Save &amp; continue <hugeicons-icon [icon]="appIcons.next" [size]="16" [strokeWidth]="1.8" />
          </ui-button>
          @if (!hasNamedRole()) {
            <span class="need">Name at least one role to continue.</span>
          }
        </div>
      </div>
    </section>
  `,
  styles: `
    .wrap {
      padding: clamp(2rem, 5vw, 3.5rem) 0 4rem;
    }
    .head {
      margin-bottom: 2rem;
    }
    .lead {
      display: block;
      color: var(--ui-color-text-muted);
      margin-top: 0.6rem;
    }
    .note {
      display: block;
      margin-bottom: 1.4rem;
    }
    .roles {
      display: flex;
      flex-direction: column;
      gap: 1.4rem;
    }
    .role {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      padding-bottom: 1.2rem;
      border-bottom: 1px solid var(--ui-color-border);
    }
    .role:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .role__head {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.6rem;
      align-items: end;
    }
    .roles__actions {
      margin-top: 1.4rem;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }
    .suggest {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem;
    }
    .suggest__label {
      font-size: 0.85rem;
      color: var(--ui-color-text-muted);
      margin-right: 0.25rem;
    }
    .more {
      align-self: flex-start;
      padding: 0;
      font: inherit;
      font-size: 0.85rem;
      color: var(--ui-color-primary);
      background: none;
      border: 0;
      cursor: pointer;
    }
    .palette {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .palette__label {
      font-size: 0.9rem;
      font-weight: 600;
    }
    .palette__opt {
      font-weight: 400;
      color: var(--ui-color-text-muted);
    }
    .palette__hint {
      margin: 0;
      font-size: 0.85rem;
      color: var(--ui-color-text-muted);
    }
    .palette__main {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .palette__shades {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
      gap: 0.6rem;
    }
    .need {
      font-size: 0.9rem;
      color: var(--ui-color-text-muted);
    }
    .actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      margin-top: 1.6rem;
    }
  `,
})
export class RolesComponent implements OnInit {
  protected readonly appIcons = APP_ICONS;
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly campaignId = input.required<string>();
  protected readonly stepKey = WizardStepKey.Roles;
  protected readonly eyebrow = wizardStepEyebrow(WizardStepKey.Roles);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);

  /** Content blocks the selected template exposes (raw manifest strings). */
  protected readonly contentBlocks = signal<string[]>([]);
  protected readonly hasBlocks = computed(() => this.contentBlocks().length > 0);
  protected readonly blockOptions = computed<UiCheckboxOption[]>(() =>
    this.contentBlocks().map((b) => ({ value: b, label: this.humanize(b) })),
  );

  protected readonly roles = this.fb.array<RoleGroup>([]);

  /** Which groups have "More options" open. Closed by default: most hosts only need a name. */
  private readonly open = signal<ReadonlySet<number>>(new Set());
  protected isOpen(i: number): boolean {
    return this.open().has(i);
  }
  protected toggleMore(i: number): void {
    this.open.update((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  /** Whether this design has colours or fonts to change; decides where Save goes next. */
  private readonly hasTheme = signal(false);

  /** The design's own roles, offered as one-tap additions rather than filled in for you. */
  private readonly declared = signal<string[]>([]);
  protected readonly form = this.fb.group({ roles: this.roles });

  private readonly rolesValue = toSignal(this.roles.valueChanges, { initialValue: this.roles.getRawValue() });
  protected readonly suggestions = computed(() => {
    const taken = new Set(this.rolesValue().map((r) => (r.name ?? '').trim().toLowerCase()));
    return this.declared().filter((n) => !taken.has(n.toLowerCase()));
  });
  /** The step can't be left without one: every guest has to be given a role later. */
  protected readonly hasNamedRole = computed(() => this.rolesValue().some((r) => !!r.name?.trim()));

  ngOnInit(): void {
    this.api.getCampaignSummary(this.campaignId()).subscribe({
      next: (summary) => {
        const manifest = this.parseManifest(summary.template?.manifestJson);
        this.contentBlocks.set(manifest.contentBlocks ?? []);
        this.hasTheme.set((manifest.theme?.keys ?? []).length > 0);
        this.declared.set(this.declaredRoles(manifest));

        const saved = this.parseRoles(summary.rolesJson);
        if (saved.length) {
          for (const r of saved) {
            this.roles.push(this.newRole(r.name, r.contentBlocks, r.palette ?? []));
          }
        } else {
          // One group called "Guests" covers most events. A design's own roles (bridesmaids, VIPs)
          // are offered below as suggestions instead of being filled in, which put wedding roles
          // on a birthday.
          this.roles.push(this.newRole('Guests'));
        }
        this.loading.set(false);
      },
      error: () => {
        // On failure still let the user work with an empty role.
        if (!this.roles.length) {
          this.roles.push(this.newRole('Guests'));
        }
        this.loading.set(false);
      },
    });
  }

  private newRole(name = '', blocks: string[] = [], palette: string[] = []) {
    return this.fb.group({
      name: this.fb.control(name),
      contentBlocks: this.fb.control<string[]>(blocks),
      palette: this.fb.control<string[]>(palette.filter(isHex)),
    });
  }

  /** The colour the shades were made from: the third of the four, which is the picked colour itself. */
  protected mainColour(index: number): string {
    const palette = this.roles.at(index).controls.palette.value;
    // Empty until a colour is picked, so nothing looks already chosen.
    return palette[2] ?? palette[0] ?? '';
  }

  protected suggestShades(index: number, hex: string): void {
    if (!isHex(hex)) return;
    this.roles.at(index).controls.palette.setValue(shadesOf(hex));
  }

  protected setShade(index: number, shade: number, hex: string): void {
    if (!isHex(hex)) return;
    const control = this.roles.at(index).controls.palette;
    control.setValue(control.value.map((c, j) => (j === shade ? hex : c)));
  }

  protected clearPalette(index: number): void {
    this.roles.at(index).controls.palette.setValue([]);
  }

  protected addRole(name = ''): void {
    this.roles.push(this.newRole(name));
  }

  protected removeRole(index: number): void {
    if (this.roles.length > 1) {
      this.roles.removeAt(index);
      this.open.set(new Set());
    } else {
      this.roles.at(0).reset({ name: '', contentBlocks: [], palette: [] });
    }
  }

  protected continueToTheming(): void {
    if (this.saving() || !this.hasNamedRole()) {
      return;
    }
    const roles: RoleDefinition[] = this.roles
      .getRawValue()
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        // Only keep blocks the current template actually offers.
        contentBlocks: r.contentBlocks.filter((b) =>
          this.contentBlocks().includes(b),
        ),
        palette: r.palette.filter(isHex),
      }));

    this.saving.set(true);
    this.api.setRoles(this.campaignId(), roles).subscribe({
      next: () => {
        this.saving.set(false);
        this.goToTheming();
      },
      error: () => this.saving.set(false),
    });
  }

  private goToTheming(): void {
    this.router.navigate(['/create', this.campaignId(), this.hasTheme() ? 'theming' : 'editor']);
  }

  private parseManifest(manifestJson: string | undefined): TemplateManifest {
    if (!manifestJson) {
      return {};
    }
    try {
      return JSON.parse(manifestJson) as TemplateManifest;
    } catch {
      return {};
    }
  }

  /** The roles the template itself declares, preferring their human labels over raw slugs. */
  private declaredRoles(manifest: TemplateManifest): string[] {
    if (manifest.roleDefinitions?.length) {
      return manifest.roleDefinitions.map((r) => r.label || r.slug).filter((n) => !!n);
    }
    return (manifest.roles ?? []).map((slug) => this.humanize(slug)).filter((n) => !!n);
  }

  private parseRoles(rolesJson: string | undefined): RoleDefinition[] {
    if (!rolesJson) {
      return [];
    }
    try {
      const blob = JSON.parse(rolesJson) as RolesBlob;
      if (!Array.isArray(blob.roles)) {
        return [];
      }
      return blob.roles.map((r) => ({
        name: r.name ?? '',
        contentBlocks: Array.isArray(r.contentBlocks) ? r.contentBlocks : [],
        palette: Array.isArray(r.palette) ? r.palette : [],
      }));
    } catch {
      return [];
    }
  }

  /**
   * Turns a block id into a readable label. Ids are camelCase by convention
   * (`vipSchedule`, `maleDressCode`), so the camel boundaries have to split too — otherwise the
   * inviter reads "VipSchedule" instead of "Vip schedule".
   */
  private humanize(block: string): string {
    const spaced = block
      .replace(/[-_]+/g, ' ')
      .replace(/(?<=[a-z0-9])(?=[A-Z])/g, ' ')
      .trim();
    return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase() : block;
  }
}
