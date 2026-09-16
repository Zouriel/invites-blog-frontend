import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UiButton, UiIconButton, UiSegmented } from '@zouriel/ui/button';
import { UiDrawer } from '@zouriel/ui/dialog';
import { UiEditableText } from '@zouriel/ui/form';
import { UiResizeHandle } from '@zouriel/ui/layout';
import { UiMeter } from '@zouriel/ui/progress';
import { UiTooltip } from '@zouriel/ui/overlay';
import { UiAlert } from '@zouriel/ui/alert';
import { UiBadge } from '@zouriel/ui/badge';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { SeoService } from '../../shared/services/seo.service';
import { DesignStore, type SampleMode } from './design.store';
import type { ElementType } from './model/scene';
import { EditorCanvasComponent } from './editor-canvas.component';
import { EditorPropertiesComponent } from './editor-properties.component';
import { EditorTimelineComponent } from './editor-timeline.component';
import { EditorVariablesComponent } from './editor-variables.component';
import { PublishDialogComponent } from './publish-dialog.component';

interface Tool {
  type: ElementType | 'upload';
  label: string;
  key: string;
  glyph: string;
}

/**
 * The template designer: a phone to design on, the scroll track underneath, the inspector beside.
 * Route: `/design/:id`. Everything state-like lives in {@link DesignStore}, provided here so each open
 * design gets its own.
 */
@Component({
  selector: 'app-design-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DesignStore],
  imports: [
    FormsModule, RouterLink, UiButton, UiIconButton, UiSegmented, UiDrawer, UiEditableText, UiResizeHandle, UiMeter, UiTooltip,
    UiAlert, UiBadge, UiSpinner, UiEmptyState,
    EditorCanvasComponent, EditorPropertiesComponent, EditorTimelineComponent, EditorVariablesComponent, PublishDialogComponent,
  ],
  templateUrl: './design-editor.component.html',
  styleUrl: './design-editor.component.scss',
  host: { '(window:keydown)': 'onKey($event)', '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class DesignEditorComponent {
  protected readonly store = inject(DesignStore);
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService, { optional: true });

  protected readonly timelineHeight = signal(readNumber('ib-designer-timeline', 260));
  protected readonly interact = signal(false);
  protected readonly checkOpen = signal(false);
  protected readonly publishOpen = signal(false);
  protected readonly inspectorOpen = signal(false);
  protected readonly imported = signal(this.route.snapshot.queryParamMap.get('imported') === '1');

  protected readonly tools: Tool[] = [
    { type: 'text', label: 'Text', key: 'T', glyph: 'T' },
    { type: 'shape', label: 'Shape', key: 'R', glyph: '▢' },
    { type: 'slot', label: 'Photo slot', key: 'P', glyph: '▣' },
    { type: 'upload', label: 'Illustration or picture', key: 'I', glyph: '✿' },
    { type: 'rsvp', label: 'RSVP button', key: 'B', glyph: '✉' },
    { type: 'link', label: 'Camera, photos or map link', key: 'L', glyph: '↗' },
    { type: 'dress', label: 'Dress colours', key: 'D', glyph: '◐' },
  ];

  protected readonly sampleOptions = [
    { value: 'filled', label: 'Filled' }, { value: 'empty', label: 'Empty fields' }, { value: 'roles', label: 'Two roles' },
  ];

  protected readonly saveLabel = computed(() => ({
    saved: 'All changes saved', dirty: 'Unsaved changes', saving: 'Saving…', offline: 'Offline — saved on this device', conflict: 'Changed elsewhere',
  })[this.store.saveState()]);

  protected readonly sizeText = computed(() => `${Math.round((this.store.preview()?.bytes ?? 0) / 1024)} KB`);

  protected readonly publishLabel = computed(() => {
    const t = this.store.design()?.template;
    if (!t) return 'Publish';
    return this.store.unpublished() ? `Publish v${bump(t.version)}` : `v${t.version} live`;
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id')!;
    void this.store.load(id);

    effect(() => {
      const name = this.store.name();
      if (name) document.title = `${name} · Designer · invites.blog`;
    });
    effect(() => {
      try { localStorage.setItem('ib-designer-timeline', String(this.timelineHeight())); } catch { /* private mode */ }
    });
    // Keep the playhead inside the page when sections shrink.
    effect(() => {
      const range = this.store.range();
      if (this.store.playhead() > range) this.store.playhead.set(range);
    });
    inject(DestroyRef).onDestroy(() => (document.title = 'invites.blog'));
  }

  protected rename(name: string): void {
    this.store.rename(name);
  }

  protected useTool(tool: Tool, fileInput: HTMLInputElement): void {
    if (tool.type === 'upload') {
      fileInput.click();
      return;
    }
    this.store.add(tool.type);
    this.inspectorOpen.set(true);
  }

  protected onUpload(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.store.importAsset(file);
  }

  protected setSample(value: string | null): void {
    if (value) this.store.sample.set(value as SampleMode);
  }

  protected selectIssue(elementId: string | null | undefined): void {
    if (!elementId) return;
    this.store.select(elementId);
    this.checkOpen.set(false);
  }

  protected onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    const typing = !!target?.closest('input, textarea, select, [contenteditable="true"], ui-token-input, [role="textbox"]');
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();

    if (mod && key === 's') {
      e.preventDefault();
      void this.store.save();
      return;
    }
    if (typing) return;
    if (mod && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.store.redo();
      else this.store.undo();
      return;
    }
    if (mod && key === 'y') {
      e.preventDefault();
      this.store.redo();
      return;
    }
    if (mod && key === 'd') {
      e.preventDefault();
      this.store.duplicate();
      return;
    }
    if (mod && key === 'g') {
      e.preventDefault();
      if (e.shiftKey) this.store.ungroup();
      else this.store.group();
      return;
    }
    if (mod) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.store.selection().length) {
        e.preventDefault();
        this.store.remove();
      }
      return;
    }
    if (e.key === 'Escape') {
      this.store.editingTextId.set(null);
      this.store.select(null);
      return;
    }
    if (key === 'k' && this.store.primaryId()) {
      this.store.addKeyframeAtPlayhead(this.store.primaryId()!);
      return;
    }
    const tool = this.tools.find((t) => t.key.toLowerCase() === key);
    if (tool && tool.type !== 'upload') this.store.add(tool.type);
  }

  protected onBeforeUnload(e: BeforeUnloadEvent): void {
    if (this.store.saveState() === 'dirty' || this.store.saveState() === 'saving') {
      void this.store.save();
      e.preventDefault();
    }
  }

  protected readonly issueCount = computed(() => this.store.issues().length);
}

function bump(v: string): string {
  const parts = v.split('.');
  return parts.length === 3 && /^\d+$/.test(parts[2]) ? `${parts[0]}.${parts[1]}.${+parts[2] + 1}` : '1.0.1';
}

function readNumber(key: string, fallback: number): number {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}
