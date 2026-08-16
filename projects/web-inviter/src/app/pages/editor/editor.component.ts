import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiBadge } from 'ui/badge';
import {
  UiCheckboxGroup,
  UiCheckboxOption,
  UiColorPicker,
  UiFormField,
  UiInput,
  UiSelect,
  UiTextarea,
  UiTimePicker,
} from 'ui/form';
import { UiDatePicker } from 'ui/datepicker';
import { ApiService } from '../../shared/api/api.service';
import {
  CustomContent,
  RoleDefinition,
  ScopedValue,
  TemplateImageSlot,
  TemplateManifest,
} from '../../shared/utils/types/api.types';
import { SafeUrlPipe } from '../../shared/pipes/safe-url.pipe';
import { WizardStepsComponent } from '../../features/wizard/wizard-steps.component';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';

/** One dynamically-rendered builder field, derived from the template's manifest. */
interface EditorField {
  path: string; // the data-var/href path, e.g. "event.title"
  id: string; // sanitized form-control name
  label: string;
  type: string; // text | textarea | date | time | url | color | select
  options: string[]; // for type: 'select'
  required: boolean;
}

/**
 * One shared empty array for "applies to everyone". It must be the SAME reference every time: these
 * are bound with [ngModel], and returning a fresh [] per change-detection pass makes Angular see an
 * endless stream of new values (NG0103).
 */
const NO_ROLES: string[] = [];

// Legacy flat keys used before the builder became manifest-driven — read as a prefill fallback.
const LEGACY_KEYS: Record<string, string> = {
  'event.title': 'title',
  'event.subtitle': 'subtitle',
  'event.description': 'description',
  'event.date': 'date',
  'event.time': 'time',
  'event.schedule': 'schedule',
  'event.dressCode': 'dressCode',
};

@Component({
  selector: 'app-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    // FormsModule alongside ReactiveFormsModule: the dynamic fields are reactive, while the per-value
    // role scoping is plain ngModel against signals rather than another parallel form group.
    FormsModule,
    ReactiveFormsModule,
    UiButton,
    UiCard,
    UiText,
    UiBadge,
    UiCheckboxGroup,
    UiColorPicker,
    UiFormField,
    UiInput,
    UiSelect,
    UiTextarea,
    UiTimePicker,
    UiDatePicker,
    SafeUrlPipe,
    WizardStepsComponent,
  ],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.scss',
})
export class EditorComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly campaignId = input.required<string>();
  protected readonly stepKey = WizardStepKey.Editor;

  private readonly iframe = viewChild<ElementRef<HTMLIFrameElement>>('preview');

  // The dynamic form + its field metadata are built once the template manifest loads.
  protected readonly form = signal<FormGroup | null>(null);
  protected readonly fields = signal<EditorField[]>([]);
  private titleFieldId: string | null = null;
  // Everything else already in customContentJson (e.g. venue from its own step) — preserved on save.
  private baseContent: Record<string, unknown> = {};

  // Image slots declared by the template (one per data-src). A gallery slot holds a list of URLs,
  // a normal slot a single one.
  protected readonly imageSlots = signal<TemplateImageSlot[]>([]);
  protected readonly imageUrls = signal<Record<string, string | string[]>>({});
  protected readonly uploadingSlot = signal<string | null>(null);

  /**
   * Which roles each value applies to. An empty list means every role — the default, and the only
   * possibility when the inviter defined a single role, in which case the scoping UI never appears.
   */
  protected readonly fieldRoles = signal<Record<string, string[]>>({});
  protected readonly imageRoles = signal<Record<string, string[]>>({});
  /** Which field/slot currently has its "who sees this" picker open. */
  protected readonly scopingOpen = signal<string | null>(null);

  protected readonly roles = signal<string[]>([]);
  protected readonly hasRoles = computed(() => this.roles().length > 1);
  protected readonly roleOptions = computed<UiCheckboxOption[]>(() =>
    this.roles().map((r) => ({ value: r, label: r })),
  );

  private readonly formValue = signal<Record<string, unknown>>({});
  protected readonly titleValue = computed(() => {
    const v = this.formValue();
    return (this.titleFieldId ? (v[this.titleFieldId] as string) : '') ?? '';
  });

  protected readonly packageUrl = signal<string | null>(null);
  protected readonly previewSrc = computed(() => {
    const url = this.packageUrl();
    return url ? url + 'index.html' : null;
  });

  protected readonly saving = signal(false);
  protected readonly savedAt = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.campaignId();

    const resume = this.route.snapshot.queryParamMap.get('resume');
    if (resume) {
      this.api.storeToken(id, resume);
    }

    const meta = this.api.getMeta(id);
    if (meta.packageUrl) {
      this.packageUrl.set(meta.packageUrl);
    }

    // The template's manifest drives which fields to render; existing content prefills them.
    this.api.getCampaignSummary(id).subscribe((summary) => {
      let manifest: TemplateManifest = {};
      if (summary.template?.manifestJson) {
        try {
          manifest = JSON.parse(summary.template.manifestJson) as TemplateManifest;
        } catch {
          manifest = {};
        }
      }
      let content: CustomContent & Record<string, unknown> = {};
      if (summary.customContentJson) {
        try {
          content = JSON.parse(summary.customContentJson);
        } catch {
          content = {};
        }
      }
      this.baseContent = content;

      // The roles the inviter named in step 1 — what a value can be scoped to.
      try {
        const blob = JSON.parse(summary.rolesJson ?? '{}') as { roles?: RoleDefinition[] };
        this.roles.set((blob.roles ?? []).map((r) => r.name).filter((n) => !!n?.trim()));
      } catch {
        this.roles.set([]);
      }

      this.imageSlots.set(manifest.imageSlots ?? []);
      this.readImages(content, manifest.imageSlots ?? []);
      this.buildForm(manifest, content, meta.title);
      this.pushPreview();
    });
  }

  /** Reads saved image values, tolerating both the scoped shape and the older bare-value one. */
  private readImages(content: CustomContent, slots: TemplateImageSlot[]): void {
    const urls: Record<string, string | string[]> = {};
    const roles: Record<string, string[]> = {};
    const bySlot = new Map(slots.map((s) => [s.key, s]));

    for (const [key, entry] of Object.entries(content.imageSlots ?? {})) {
      const { value, roles: scoped } = this.unwrap(entry);
      if (value == null) continue;
      // A gallery keeps a list even if only one photo was picked, so "add another" stays possible.
      urls[key] = bySlot.get(key)?.multiple
        ? Array.isArray(value)
          ? value
          : [value]
        : Array.isArray(value)
          ? (value[0] ?? '')
          : value;
      if (scoped.length) roles[key] = scoped;
    }

    this.imageUrls.set(urls);
    this.imageRoles.set(roles);
  }

  /** Normalizes a stored entry — `{ value, roles }` or a bare value — into both parts. */
  private unwrap(entry: ScopedValue | string | undefined): {
    value: string | string[] | null;
    roles: string[];
  } {
    if (entry == null) return { value: null, roles: [] };
    if (typeof entry === 'string') return { value: entry, roles: [] };
    return { value: entry.value ?? null, roles: Array.isArray(entry.roles) ? entry.roles : [] };
  }

  private buildForm(
    manifest: TemplateManifest,
    content: CustomContent & Record<string, unknown>,
    fallbackTitle?: string,
  ): void {
    const imageKeys = new Set((manifest.imageSlots ?? []).map((s) => s.key));

    // Prefer the manifest's typed `fields`; fall back to `variables` (older templates) with inference.
    const raw: { path: string; label: string; type: string; options: string[] }[] = manifest.fields
      ?.length
      ? manifest.fields.map((f) => ({
          path: f.key,
          label: f.label,
          type: f.type,
          options: f.options ?? [],
        }))
      : (manifest.variables ?? []).map((p) => ({
          path: p,
          label: this.prettify(p),
          type: this.inferType(p),
          options: [],
        }));

    // Event-authored fields only; venue/inviter/roles have their own steps, guest/rsvp/invite are dynamic.
    const fields: EditorField[] = raw
      .filter(
        (f) =>
          f.path.startsWith('event.') &&
          !f.path.startsWith('event.venue.') &&
          !imageKeys.has(f.path),
      )
      // de-dupe by path (a path can appear on multiple elements)
      .filter((f, i, arr) => arr.findIndex((x) => x.path === f.path) === i)
      .map((f, i) => ({
        path: f.path,
        id: 'f' + i,
        label: f.label,
        type: f.type,
        options: f.options,
        required: f.path === 'event.title',
      }));

    const controls: Record<string, FormControl<string>> = {};
    const savedFields = (content.fields ?? {}) as Record<string, ScopedValue | string>;
    const savedRoles: Record<string, string[]> = {};

    for (const f of fields) {
      const { value, roles } = this.unwrap(savedFields[f.path]);
      const legacy = LEGACY_KEYS[f.path];
      const initial =
        (typeof value === 'string' ? value : undefined) ??
        (legacy ? (content[legacy] as string | undefined) : undefined) ??
        (f.path === 'event.title' ? fallbackTitle : undefined) ??
        // A colour control needs a real hex to start from; everything else starts empty.
        (f.type === 'color' ? '#000000' : '');
      controls[f.id] = this.fb.control(initial, f.required ? [Validators.required] : []);
      if (roles.length) savedRoles[f.path] = roles;
      if (f.path === 'event.title') {
        this.titleFieldId = f.id;
      }
    }

    const group = this.fb.group(controls);
    this.fields.set(fields);
    this.fieldRoles.set(savedRoles);
    this.form.set(group);
    this.formValue.set(group.getRawValue());
    group.valueChanges.subscribe(() => {
      this.formValue.set(group.getRawValue());
      this.pushPreview();
    });
  }

  protected fieldError(f: EditorField): string | undefined {
    const c = this.form()?.get(f.id);
    if (!c || !c.touched || c.valid) {
      return undefined;
    }
    return `${f.label} is required.`;
  }

  protected selectOptions(f: EditorField): { label: string; value: string }[] {
    return f.options.map((o) => ({ label: o, value: o }));
  }

  // ----- Per-value role scoping -------------------------------------------------------------

  protected toggleScoping(key: string): void {
    this.scopingOpen.update((open) => (open === key ? null : key));
  }

  protected scopeLabel(roles: string[]): string {
    if (!roles.length) return 'Everyone';
    return roles.length === 1 ? roles[0] : `${roles.length} roles`;
  }

  protected fieldScope(f: EditorField): string[] {
    return this.fieldRoles()[f.path] ?? NO_ROLES;
  }

  protected setFieldScope(f: EditorField, roles: string[]): void {
    this.fieldRoles.update((m) => ({ ...m, [f.path]: roles }));
  }

  protected imageScope(slot: TemplateImageSlot): string[] {
    return this.imageRoles()[slot.key] ?? NO_ROLES;
  }

  protected setImageScope(slot: TemplateImageSlot, roles: string[]): void {
    this.imageRoles.update((m) => ({ ...m, [slot.key]: roles }));
  }

  // ----- Images ------------------------------------------------------------------------------

  /** The photos currently held for a slot, as a list (a single slot yields 0 or 1). */
  protected slotImages(slot: TemplateImageSlot): string[] {
    const value = this.imageUrls()[slot.key];
    if (!value) return [];
    return Array.isArray(value) ? value.filter((u) => !!u) : [value];
  }

  protected canAddMore(slot: TemplateImageSlot): boolean {
    if (!slot.multiple) return this.slotImages(slot).length === 0;
    const max = slot.maxImages;
    return max == null || this.slotImages(slot).length < max;
  }

  /** A short "2 of 2–8 photos" style hint, only for gallery slots that declare bounds. */
  protected slotHint(slot: TemplateImageSlot): string | undefined {
    if (!slot.multiple) return undefined;
    const count = this.slotImages(slot).length;
    const { minImages: min, maxImages: max } = slot;
    if (min != null && max != null) return `${count} of ${min}–${max} photos`;
    if (min != null) return `${count} photos (at least ${min})`;
    if (max != null) return `${count} of up to ${max} photos`;
    return `${count} ${count === 1 ? 'photo' : 'photos'}`;
  }

  protected slotBelowMinimum(slot: TemplateImageSlot): boolean {
    return !!slot.multiple && slot.minImages != null && this.slotImages(slot).length < slot.minImages;
  }

  /** Uploads the chosen file(s) for a slot, then binds the URLs and refreshes the preview. */
  protected onImagePick(slot: TemplateImageSlot, event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    if (!picked.length) {
      return;
    }

    // A single slot takes one file however many were dropped; a gallery respects its own maximum.
    const room = slot.multiple
      ? (slot.maxImages ?? Number.MAX_SAFE_INTEGER) - this.slotImages(slot).length
      : 1;
    const files = picked.slice(0, Math.max(0, room));
    if (!files.length) {
      input.value = '';
      return;
    }

    this.uploadingSlot.set(slot.key);
    this.api.uploadCampaignImages(this.campaignId(), files, slot.key).subscribe({
      next: (urls) => {
        this.imageUrls.update((m) => ({
          ...m,
          [slot.key]: slot.multiple ? [...this.slotImages(slot), ...urls] : urls[0],
        }));
        this.uploadingSlot.set(null);
        input.value = '';
        this.pushPreview();
      },
      error: () => {
        this.uploadingSlot.set(null);
        input.value = '';
      },
    });
  }

  protected removeImage(slot: TemplateImageSlot, index = 0): void {
    this.imageUrls.update((m) => {
      const next = { ...m };
      if (!slot.multiple) {
        delete next[slot.key];
        return next;
      }
      const list = this.slotImages(slot).filter((_, i) => i !== index);
      if (list.length) next[slot.key] = list;
      else delete next[slot.key];
      return next;
    });
    this.pushPreview();
  }

  /** Moves a photo within a gallery, so the inviter controls the order guests see. */
  protected moveImage(slot: TemplateImageSlot, index: number, delta: number): void {
    const list = this.slotImages(slot);
    const target = index + delta;
    if (target < 0 || target >= list.length) return;

    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    this.imageUrls.update((m) => ({ ...m, [slot.key]: next }));
    this.pushPreview();
  }

  // ----- Persistence + preview ---------------------------------------------------------------

  private buildContent(): CustomContent {
    const group = this.form();
    const fieldsMap: Record<string, ScopedValue> = {};
    if (group) {
      for (const f of this.fields()) {
        const val = group.get(f.id)?.value as string | undefined;
        if (val != null && String(val).trim() !== '') {
          fieldsMap[f.path] = { value: val, roles: this.fieldScope(f) };
        }
      }
    }

    const images: Record<string, ScopedValue> = {};
    for (const slot of this.imageSlots()) {
      const picked = this.slotImages(slot);
      if (!picked.length) continue;
      images[slot.key] = {
        value: slot.multiple ? picked : picked[0],
        roles: this.imageScope(slot),
      };
    }

    return { ...this.baseContent, fields: fieldsMap, imageSlots: images };
  }

  /** Assigns a value into an object at a dot-path, creating nested objects as needed. */
  private setPath(root: Record<string, unknown>, dotPath: string, value: unknown): void {
    const parts = dotPath.split('.').filter(Boolean);
    if (!parts.length) {
      return;
    }
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (typeof node[key] !== 'object' || node[key] === null) {
        node[key] = {};
      }
      node = node[key] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = value;
  }

  protected pushPreview(): void {
    const frame = this.iframe()?.nativeElement;
    if (!frame?.contentWindow) {
      return;
    }
    const group = this.form();
    const data: Record<string, unknown> = { guest: { name: 'Guest' }, inviter: { name: '' } };
    if (group) {
      for (const f of this.fields()) {
        const val = group.get(f.id)?.value as string | undefined;
        if (val) {
          this.setPath(data, f.path, val);
        }
      }
    }
    // The preview shows everything regardless of scoping — it's the inviter's own view of the design.
    for (const slot of this.imageSlots()) {
      const picked = this.slotImages(slot);
      if (picked.length) {
        this.setPath(data, slot.key, slot.multiple ? picked : picked[0]);
      }
    }
    frame.contentWindow.postMessage({ __inviteData: data }, '*');
  }

  protected onFrameLoad(): void {
    setTimeout(() => this.pushPreview(), 120);
  }

  private prettify(path: string): string {
    const leaf = path.split('.').pop() ?? path;
    const spaced = leaf
      .replace(/[_-]/g, ' ')
      .replace(/(?<=[a-z0-9])(?=[A-Z])/g, ' ')
      .trim();
    return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : path;
  }

  private inferType(path: string): string {
    const leaf = (path.split('.').pop() ?? '').toLowerCase();
    if (leaf.includes('date')) return 'date';
    if (leaf.includes('time')) return 'time';
    if (
      ['description', 'schedule', 'note', 'message', 'story', 'address'].some((k) =>
        leaf.includes(k),
      )
    )
      return 'textarea';
    if (leaf.includes('link') || leaf.includes('url')) return 'url';
    return 'text';
  }

  private persist() {
    return this.api.saveContent(this.campaignId(), {
      customContentJson: JSON.stringify(this.buildContent()),
    });
  }

  protected saveDraft(): void {
    this.saving.set(true);
    this.persist().subscribe({
      next: () => {
        this.saving.set(false);
        this.savedAt.set(new Date().toLocaleTimeString());
      },
      error: () => this.saving.set(false),
    });
  }

  protected next(): void {
    const group = this.form();
    if (group && group.invalid) {
      group.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.persist().subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/create', this.campaignId(), 'guests']);
      },
      error: () => this.saving.set(false),
    });
  }
}
