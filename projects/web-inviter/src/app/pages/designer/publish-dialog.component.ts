import { ChangeDetectionStrategy, Component, computed, effect, inject, model, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UiModal, UiToastService } from '@zouriel/ui/dialog';
import { UiButton } from '@zouriel/ui/button';
import { UiFileUpload, UiFormField, UiInput, UiSelect, UiTextarea, type UiSelectOption } from '@zouriel/ui/form';
import { UiStepper } from '@zouriel/ui/navigation';
import { UiAlert } from '@zouriel/ui/alert';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiBadge } from '@zouriel/ui/badge';
import { UiMeter } from '@zouriel/ui/progress';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';
import { catalog } from '../../shared/utils/plans';
import { DesignStore } from './design.store';
import type { DesignIssue, PublishResult } from './model/scene';
import { renderPoster } from './model/poster';

type Step = 0 | 1 | 2 | 3;

/**
 * Publishing, in the order the decisions actually come: does it pass Check, what is it, who can use
 * it, what does its card look like. The server recompiles from its own copy of the scene, so this
 * saves first and publishes the revision it just checked.
 */
@Component({
  selector: 'app-publish-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, RouterLink, UiModal, UiButton, UiFileUpload, UiFormField, UiInput, UiSelect, UiTextarea, UiStepper, UiAlert,
    UiSpinner, UiBadge, UiMeter,
  ],
  templateUrl: './publish-dialog.component.html',
  styleUrl: './publish-dialog.component.scss',
})
export class PublishDialogComponent {
  protected readonly store = inject(DesignStore);
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);
  protected readonly isStudio = inject(SessionStore).isStudio;
  protected readonly discount = catalog().studioDiscountPercent;

  readonly open = model(false);

  protected readonly steps = [
    { label: 'Check' }, { label: 'Details' }, { label: 'Who can use it' }, { label: 'Published' },
  ];
  protected readonly step = signal<Step>(0);
  protected readonly checking = signal(false);
  protected readonly issues = signal<DesignIssue[]>([]);
  protected readonly bytes = signal(0);
  protected readonly types = signal<UiSelectOption[]>([]);
  protected readonly publishing = signal(false);
  protected readonly result = signal<PublishResult | null>(null);

  protected name = '';
  protected category = '';
  protected description = '';
  protected readonly visibility = signal<'Private' | 'Person' | 'Public'>('Private');
  /** Who a "for someone" template is for. */
  protected assignedEmail = '';

  protected readonly posterUrl = signal<string | null>(null);
  private posterBlob: Blob | null = null;

  protected readonly errors = computed(() => this.issues().filter((i) => i.severity === 'error'));
  protected readonly warnings = computed(() => this.issues().filter((i) => i.severity === 'warning'));
  protected readonly template = computed(() => this.store.design()?.template ?? null);
  protected readonly isDedicated = computed(() => this.template()?.visibility === 'Dedicated');
  protected readonly publicBlocked = computed(() => this.store.design()?.publicBlockedReason ?? null);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => void this.start());
    });
  }

  private async start(): Promise<void> {
    this.step.set(0);
    this.result.set(null);
    const design = this.store.design();
    const template = design?.template;
    this.name = this.store.name();
    this.category = template?.category ?? '';
    this.description = template?.description ?? '';
    this.assignedEmail = template?.assignedEmail ?? '';
    this.visibility.set(template?.visibility === 'Public' ? 'Public' : template?.assignedEmail ? 'Person' : 'Private');
    if (!this.types().length) {
      try {
        const types = await firstValueFrom(this.api.listTemplateTypes());
        this.types.set(types.map((t) => ({ value: t.name, label: t.name })));
      } catch {
        this.types.set([]);
      }
    }
    await this.runCheck();
    void this.drawPoster();
  }

  protected async runCheck(): Promise<void> {
    this.checking.set(true);
    try {
      // Check the saved revision — the one that will be published.
      await this.store.save();
      const d = this.store.design();
      if (!d) return;
      const result = await firstValueFrom(this.api.checkDesign(d.id));
      this.issues.set(result.issues);
      this.bytes.set(result.bytes);
    } finally {
      this.checking.set(false);
    }
  }

  protected goTo(elementId: string | null | undefined): void {
    if (!elementId) return;
    this.open.set(false);
    this.store.select(elementId);
  }

  protected async drawPoster(): Promise<void> {
    const scene = this.store.scene();
    const catalog = this.store.catalog();
    if (!scene || !catalog) return;
    try {
      const blob = await renderPoster(scene, this.store.playhead(), { fonts: catalog.fonts, variables: catalog.variables });
      this.setPoster(blob, 'frame');
    } catch {
      this.posterUrl.set(null);
    }
  }

  protected onPosterFile(files: File[]): void {
    const file = files[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      this.toast.warning('Use a PNG, JPEG or WebP picture.');
      return;
    }
    this.setPoster(file, 'upload');
  }

  private setPoster(blob: Blob, source: 'frame' | 'upload'): void {
    const old = this.posterUrl();
    if (old) URL.revokeObjectURL(old);
    this.posterBlob = blob;
    this.posterUrl.set(URL.createObjectURL(blob));
  }

  protected detailsValid(): boolean {
    const who = this.visibility() === 'Public' ? this.description.trim().length >= 10
      : this.visibility() === 'Person' ? this.emailValid() : true;
    return this.name.trim().length > 0 && !!this.category && who;
  }

  protected emailValid(): boolean {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.assignedEmail.trim());
  }

  protected publishLabel(): string {
    switch (this.visibility()) {
      case 'Public': return 'Publish to the gallery';
      case 'Person': return 'Publish for them';
      default: return 'Publish privately';
    }
  }

  protected async publish(): Promise<void> {
    const design = this.store.design();
    if (!design) return;
    this.publishing.set(true);
    try {
      this.store.rename(this.name);
      if (!(await this.store.save())) {
        this.toast.danger('The latest changes couldn’t be saved, so nothing was published. Try again in a moment.');
        return;
      }
      const result = await firstValueFrom(this.api.publishDesign(design.id, {
        visibility: this.visibility(),
        assignedEmail: this.visibility() === 'Person' ? this.assignedEmail.trim() : null,
        name: this.name.trim(),
        category: this.category,
        description: this.description.trim(),
        campaignId: design.campaignId ?? null,
        revision: this.store.revision(),
        poster: this.posterBlob,
      }));
      this.store.replaceDesign(result.design);
      this.result.set(result);
      this.step.set(3);
    } catch (e) {
      const errors = (e as { errors?: { message: string; field?: string }[] }).errors;
      if (errors?.length) {
        this.issues.set(errors.map((x) => ({ severity: 'error', code: 'check', message: x.message, elementId: x.field ?? null })));
        this.step.set(0);
      }
    } finally {
      this.publishing.set(false);
    }
  }

  protected nextVersion(v: string): string {
    const parts = v.split('.');
    return parts.length === 3 && /^\d+$/.test(parts[2]) ? `${parts[0]}.${parts[1]}.${+parts[2] + 1}` : '1.0.1';
  }

  protected formatBytes(n: number): string {
    return `${Math.round(n / 1024)} KB`;
  }
}
