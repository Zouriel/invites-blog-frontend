import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiAlert } from 'ui/alert';
import { UiCheckboxGroup, UiCheckboxOption, UiFormField, UiInput } from 'ui/form';
import { ApiService } from '../../shared/api/api.service';
import { RoleDefinition } from '../../shared/utils/types/api.types';
import { WizardStepsComponent } from '../../features/wizard/wizard-steps.component';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';

/** Shape of the parsed template manifest (only the field this step needs). */
type TemplateManifest = { contentBlocks?: string[] };
/** Shape of the persisted rolesJson blob. */
type RolesBlob = { roles?: RoleDefinition[] };
/** One role's reactive form group. */
type RoleGroup = FormGroup<{
  name: FormControl<string>;
  contentBlocks: FormControl<string[]>;
}>;

/**
 * Roles wizard step (between Design and Guests). Lets the inviter define guest
 * roles and map each to the template's content blocks. Reads the campaign
 * summary on init (template blocks + already-saved roles) and PUTs via setRoles.
 */
@Component({
  selector: 'app-roles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    UiButton,
    UiCard,
    UiText,
    UiAlert,
    UiFormField,
    UiInput,
    UiCheckboxGroup,
    WizardStepsComponent,
  ],
  template: `
    <section class="wrap">
      <div class="ib-container ib-container--narrow">
        <app-wizard-steps [active]="stepKey" />
        <header class="head">
          <span class="eyebrow">Step 2 · Roles</span>
          <ui-text variant="h1">Define your guest roles</ui-text>
          <ui-text variant="body" class="lead">
            Group guests into roles (e.g. Family, VIP, Staff) and choose which
            template sections each role should see. You can tag guests with these
            roles in the next step.
          </ui-text>
        </header>

        @if (!hasBlocks() && !loading()) {
          <ui-alert class="note" tone="info">
            This template has no role-specific sections, so there is nothing to
            map here. You can still name roles to tag your guests, or skip this
            step entirely.
          </ui-alert>
        }

        <ui-card padding="lg" [formGroup]="form">
          <div class="roles" formArrayName="roles">
            @for (role of roles.controls; track role; let i = $index) {
              <div class="role" [formGroupName]="i">
                <div class="role__head">
                  <ui-form-field label="Role name" class="role__name">
                    <ui-input formControlName="name" placeholder="e.g. Family" />
                  </ui-form-field>
                  <ui-button
                    variant="ghost"
                    size="sm"
                    (click)="removeRole(i)"
                    aria-label="Remove role"
                  >
                    ✕
                  </ui-button>
                </div>

                @if (hasBlocks()) {
                  <ui-form-field
                    label="Sections this role sees"
                    hint="Leave empty to show this role the default sections."
                  >
                    <ui-checkbox-group
                      formControlName="contentBlocks"
                      [options]="blockOptions()"
                      orientation="horizontal"
                    />
                  </ui-form-field>
                }
              </div>
            }
          </div>

          <div class="roles__actions">
            <ui-button variant="outline" (click)="addRole()">+ Add role</ui-button>
          </div>
        </ui-card>

        <div class="actions">
          <ui-button
            variant="primary"
            [loading]="saving()"
            (click)="continueToGuests()"
          >
            Save &amp; continue →
          </ui-button>
          <ui-button variant="ghost" (click)="skip()">Skip for now</ui-button>
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
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly campaignId = input.required<string>();
  protected readonly stepKey = WizardStepKey.Roles;

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);

  /** Content blocks the selected template exposes (raw manifest strings). */
  protected readonly contentBlocks = signal<string[]>([]);
  protected readonly hasBlocks = computed(() => this.contentBlocks().length > 0);
  protected readonly blockOptions = computed<UiCheckboxOption[]>(() =>
    this.contentBlocks().map((b) => ({ value: b, label: this.humanize(b) })),
  );

  protected readonly roles = this.fb.array<RoleGroup>([]);
  protected readonly form = this.fb.group({ roles: this.roles });

  ngOnInit(): void {
    this.api.getCampaignSummary(this.campaignId()).subscribe({
      next: (summary) => {
        this.contentBlocks.set(this.parseBlocks(summary.template?.manifestJson));
        const saved = this.parseRoles(summary.rolesJson);
        if (saved.length) {
          for (const r of saved) {
            this.roles.push(this.newRole(r.name, r.contentBlocks));
          }
        } else {
          this.roles.push(this.newRole());
        }
        this.loading.set(false);
      },
      error: () => {
        // On failure still let the user work with an empty role.
        if (!this.roles.length) {
          this.roles.push(this.newRole());
        }
        this.loading.set(false);
      },
    });
  }

  private newRole(name = '', blocks: string[] = []) {
    return this.fb.group({
      name: this.fb.control(name),
      contentBlocks: this.fb.control<string[]>(blocks),
    });
  }

  protected addRole(): void {
    this.roles.push(this.newRole());
  }

  protected removeRole(index: number): void {
    if (this.roles.length > 1) {
      this.roles.removeAt(index);
    } else {
      this.roles.at(0).reset({ name: '', contentBlocks: [] });
    }
  }

  protected continueToGuests(): void {
    if (this.saving()) {
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
      }));

    this.saving.set(true);
    this.api.setRoles(this.campaignId(), roles).subscribe({
      next: () => {
        this.saving.set(false);
        this.goToGuests();
      },
      error: () => this.saving.set(false),
    });
  }

  protected skip(): void {
    this.goToGuests();
  }

  private goToGuests(): void {
    this.router.navigate(['/create', this.campaignId(), 'guests']);
  }

  private parseBlocks(manifestJson: string | undefined): string[] {
    if (!manifestJson) {
      return [];
    }
    try {
      const manifest = JSON.parse(manifestJson) as TemplateManifest;
      return Array.isArray(manifest.contentBlocks) ? manifest.contentBlocks : [];
    } catch {
      return [];
    }
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
      }));
    } catch {
      return [];
    }
  }

  private humanize(block: string): string {
    const spaced = block.replace(/[-_]+/g, ' ').trim();
    return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : block;
  }
}
