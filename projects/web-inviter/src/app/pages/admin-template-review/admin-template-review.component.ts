import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { UiStatus } from 'ui';
import { FormsModule } from '@angular/forms';
import { UiAlert } from 'ui/alert';
import { UiBadge } from 'ui/badge';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiCodeViewer } from 'ui/file-viewer';
import { UiEmptyState } from 'ui/feedback';
import { UiFormField, UiSelect, UiTextarea } from 'ui/form';
import { UiSpinner } from 'ui/spinner';
import { UiTab, UiTabs } from 'ui/tabs';
import { UiText } from 'ui/text';
import { UiToastService } from 'ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { TemplateSubmission } from '../../shared/utils/types/api.types';

/** One variable/slot/theme key as the non-technical summary view lists it. */
interface SummaryEntry {
  key: string;
  label: string;
  detail: string;
  tone: UiStatus;
}

/**
 * The community-template review queue. One submission at a time, with two views built from
 * `ui/file-viewer`: the raw markup for a reviewer who wants to read it, and a plain-language
 * summary — roles, variables and their types, image slots, theme keys — parsed out of the manifest
 * so a non-technical admin can sanity-check a submission without reading any HTML.
 */
@Component({
  selector: 'app-admin-template-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, UiAlert, UiBadge, UiButton, UiCard, UiCodeViewer, UiEmptyState,
    UiFormField, UiSelect, UiSpinner, UiTab, UiTabs, UiTextarea, UiText,
  ],
  templateUrl: './admin-template-review.component.html',
  styleUrl: './admin-template-review.component.scss',
})
export class AdminTemplateReviewComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  protected readonly loading = signal(true);
  protected readonly deciding = signal(false);
  protected readonly submissions = signal<TemplateSubmission[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly status = signal('Submitted');
  protected rejectionReason = '';

  protected readonly statuses = [
    { label: 'Awaiting review', value: 'Submitted' },
    { label: 'In review', value: 'InReview' },
    { label: 'Rejected', value: 'Rejected' },
    { label: 'Published', value: 'Published' },
    { label: 'All', value: 'all' },
  ];

  protected readonly selected = computed(
    () => this.submissions().find((s) => s.template.id === this.selectedId()) ?? null,
  );

  /** The manifest the packager derived, parsed once per selection. */
  private readonly manifest = computed<Manifest>(() => {
    const raw = this.selected()?.template.manifestJson;
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Manifest;
    } catch {
      return {};
    }
  });

  protected readonly roles = computed(() => this.manifest().roles ?? []);

  protected readonly variables = computed<SummaryEntry[]>(() =>
    (this.manifest().fields ?? []).map((f) => ({
      key: f.key,
      label: f.label,
      detail: f.type === 'select' ? `dropdown: ${(f.options ?? []).join(', ')}` : f.type,
      tone: 'neutral',
    })),
  );

  protected readonly imageSlots = computed<SummaryEntry[]>(() =>
    (this.manifest().imageSlots ?? []).map((s) => ({
      key: s.key,
      label: s.label,
      detail: s.multiple ? this.galleryDetail(s) : 'one image',
      tone: s.multiple ? 'primary' : 'neutral',
    })),
  );

  protected readonly themeKeys = computed<SummaryEntry[]>(() =>
    (this.manifest().theme?.keys ?? []).map((k) => ({
      key: k.key,
      label: k.label,
      detail: `${k.type} · default ${k.default}`,
      tone: 'warning',
    })),
  );

  protected readonly contentBlocks = computed(() => this.manifest().contentBlocks ?? []);

  constructor() {
    this.load();
  }

  protected onStatusChange(value: string): void {
    this.status.set(value);
    this.load();
  }

  protected select(id: string): void {
    this.selectedId.set(id);
    this.rejectionReason = '';
  }

  protected decide(approve: boolean): void {
    const current = this.selected();
    if (!current) return;
    if (!approve && !this.rejectionReason.trim()) {
      this.toast.danger('Give the designer a reason so they can fix it.');
      return;
    }

    this.deciding.set(true);
    this.api.reviewSubmission(current.template.id, approve, this.rejectionReason.trim()).subscribe({
      next: () => {
        this.deciding.set(false);
        this.toast.success(approve ? 'Approved and published.' : 'Rejected — the designer has been told why.');
        this.rejectionReason = '';
        this.load();
      },
      error: () => this.deciding.set(false),
    });
  }

  private galleryDetail(slot: ManifestImageSlot): string {
    const min = slot.minImages;
    const max = slot.maxImages;
    if (min && max) return `gallery, ${min}–${max} images`;
    if (min) return `gallery, at least ${min}`;
    if (max) return `gallery, up to ${max}`;
    return 'gallery, any number';
  }

  private load(): void {
    this.loading.set(true);
    this.api.listSubmissions(this.status()).subscribe({
      next: (page) => {
        this.submissions.set(page.items);
        // Keep the current selection when it survived the reload, else fall back to the first.
        const stillThere = page.items.some((s) => s.template.id === this.selectedId());
        if (!stillThere) this.selectedId.set(page.items[0]?.template.id ?? null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}

/* The manifest shape the review screen reads — see TEMPLATE-GUIDE.md for the authoring side. */
interface ManifestField {
  key: string;
  label: string;
  type: string;
  options?: string[];
  roleScope?: string;
}
interface ManifestImageSlot {
  key: string;
  label: string;
  multiple?: boolean;
  minImages?: number;
  maxImages?: number;
  roleScope?: string;
}
interface ManifestThemeKey {
  key: string;
  label: string;
  type: string;
  default: string;
}
interface Manifest {
  roles?: string[];
  fields?: ManifestField[];
  imageSlots?: ManifestImageSlot[];
  contentBlocks?: string[];
  theme?: { keys?: ManifestThemeKey[]; fonts?: string[] };
}
