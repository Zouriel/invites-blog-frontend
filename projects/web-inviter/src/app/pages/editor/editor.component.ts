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
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiBadge } from 'ui/badge';
import { UiFormField, UiInput, UiTextarea, UiTimePicker } from 'ui/form';
import { UiDatePicker } from 'ui/datepicker';
import { ApiService } from '../../shared/api/api.service';
import {
  CustomContent,
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
  type: string; // text | textarea | date | time | url
  required: boolean;
}

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
    ReactiveFormsModule,
    UiButton,
    UiCard,
    UiText,
    UiBadge,
    UiFormField,
    UiInput,
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

  // Image slots declared by the template (one per data-src), the inviter-picked URL per slot,
  // and which slot (if any) is mid-upload.
  protected readonly imageSlots = signal<TemplateImageSlot[]>([]);
  protected readonly imageUrls = signal<Record<string, string>>({});
  protected readonly uploadingSlot = signal<string | null>(null);

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
      this.imageSlots.set(manifest.imageSlots ?? []);
      if (content.imageSlots) {
        this.imageUrls.set({ ...content.imageSlots });
      }
      this.buildForm(manifest, content, meta.title);
      this.pushPreview();
    });
  }

  private buildForm(
    manifest: TemplateManifest,
    content: CustomContent & Record<string, unknown>,
    fallbackTitle?: string,
  ): void {
    const imageKeys = new Set((manifest.imageSlots ?? []).map((s) => s.key));

    // Prefer the manifest's typed `fields`; fall back to `variables` (older templates) with inference.
    const raw: { path: string; label: string; type: string }[] = manifest.fields?.length
      ? manifest.fields.map((f) => ({ path: f.key, label: f.label, type: f.type }))
      : (manifest.variables ?? []).map((p) => ({
          path: p,
          label: this.prettify(p),
          type: this.inferType(p),
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
        required: f.path === 'event.title',
      }));

    const controls: Record<string, FormControl<string>> = {};
    const savedFields = (content.fields as Record<string, string> | undefined) ?? {};
    for (const f of fields) {
      const legacy = LEGACY_KEYS[f.path];
      const initial =
        savedFields[f.path] ??
        (legacy ? (content[legacy] as string | undefined) : undefined) ??
        (f.path === 'event.title' ? fallbackTitle : undefined) ??
        '';
      controls[f.id] = this.fb.control(initial, f.required ? [Validators.required] : []);
      if (f.path === 'event.title') {
        this.titleFieldId = f.id;
      }
    }

    const group = this.fb.group(controls);
    this.fields.set(fields);
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

  private buildContent(): CustomContent {
    const group = this.form();
    const fieldsMap: Record<string, string> = {};
    if (group) {
      for (const f of this.fields()) {
        const val = group.get(f.id)?.value as string | undefined;
        if (val != null && String(val).trim() !== '') {
          fieldsMap[f.path] = val;
        }
      }
    }
    const images = this.imageUrls();
    return {
      ...this.baseContent,
      fields: fieldsMap,
      ...(Object.keys(images).length ? { imageSlots: images } : { imageSlots: {} }),
    };
  }

  /** Upload the chosen file for a slot, then bind its URL and refresh the preview. */
  protected onImagePick(slot: TemplateImageSlot, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.uploadingSlot.set(slot.key);
    this.api.uploadCampaignImage(this.campaignId(), file, slot.key).subscribe({
      next: (res) => {
        this.imageUrls.update((m) => ({ ...m, [slot.key]: res.url }));
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

  protected removeImage(slot: TemplateImageSlot): void {
    this.imageUrls.update((m) => {
      const next = { ...m };
      delete next[slot.key];
      return next;
    });
    this.pushPreview();
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
    for (const [path, url] of Object.entries(this.imageUrls())) {
      if (url) {
        this.setPath(data, path, url);
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
        this.router.navigate(['/create', this.campaignId(), 'roles']);
      },
      error: () => this.saving.set(false),
    });
  }
}
