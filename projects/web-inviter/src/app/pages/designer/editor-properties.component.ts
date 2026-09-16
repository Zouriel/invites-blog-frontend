import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton, UiIconButton, UiSegmented } from '@zouriel/ui/button';
import { UiFileUpload, UiInput, UiNumberInput, UiSelect, UiSwitch, UiTokenInput, type UiSelectOption } from '@zouriel/ui/form';
import { UiPanelSection } from '@zouriel/ui/layout';
import { UiTooltip } from '@zouriel/ui/overlay';
import { DesignStore } from './design.store';
import type { DesignElement, DesignKeyframe, Typography } from './model/scene';
import {
  labelOf, pageBoxAt, parentOf, progressAt, runsToTokens, tokensToRuns, trackOf,
} from './model/scene-ops';
import { ColorRefFieldComponent } from './fields/color-ref-field.component';
import { TypographyFieldComponent } from './fields/typography-field.component';
import { PageSettingsComponent } from './page-settings.component';

type Kind = DesignElement['type'];

const TITLES: Record<Kind, string> = {
  text: 'Text', shape: 'Shape', svg: 'Illustration', image: 'Picture', slot: 'Photo slot', rsvp: 'RSVP button',
  link: 'Link button', dress: 'Dress colours', group: 'Group',
};

/**
 * The inspector: everything about the selected element, or — with nothing selected — the page itself.
 *
 * <p>Position, rotation, scale and opacity follow the canvas's rule: on an animated element they edit
 * the keyframe under the playhead, or make one. Size and everything else edit the element.</p>
 */
@Component({
  selector: 'app-editor-properties',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, UiButton, UiIconButton, UiSegmented, UiFileUpload, UiInput, UiNumberInput, UiSelect, UiSwitch, UiTokenInput,
    UiPanelSection, UiTooltip, ColorRefFieldComponent, TypographyFieldComponent, PageSettingsComponent,
  ],
  templateUrl: './editor-properties.component.html',
  styleUrl: './editor-properties.component.scss',
})
export class EditorPropertiesComponent {
  protected readonly store = inject(DesignStore);
  private readonly contentInput = viewChild<UiTokenInput>('content');
  private readonly contentHost = viewChild('content', { read: ElementRef });

  constructor() {
    effect(() => {
      const request = this.store.tokenRequest();
      if (!request) return;
      untracked(() => {
        const host = this.contentHost()?.nativeElement as HTMLElement | undefined;
        if (host?.contains(document.activeElement)) this.contentInput()?.insertToken(request.path);
      });
    });
  }

  protected readonly el = computed(() => this.store.primary());
  protected readonly multi = computed(() => this.store.selection().length > 1);
  protected readonly title = computed(() => (this.el() ? TITLES[this.el()!.type] : ''));
  protected readonly label = computed(() => (this.el() ? labelOf(this.el()!) : ''));

  /** Values at the playhead — what the canvas shows. */
  protected readonly state = computed(() => {
    const scene = this.store.scene();
    const el = this.el();
    if (!scene || !el) return null;
    const box = pageBoxAt(scene, el.id, this.store.playhead());
    return box ? { ...box, x: round(box.x), y: round(box.y), rotate: round(box.rotate), scale: round(box.scale, 3), opacity: round(box.opacity, 2) } : null;
  });

  protected readonly animated = computed(() => (this.el()?.keyframes.length ?? 0) > 0);
  protected readonly track = computed(() => (this.store.scene() && this.el() ? trackOf(this.store.scene()!, this.el()!) : null));
  protected readonly progress = computed(() =>
    this.store.scene() && this.el() ? Math.round(progressAt(this.store.scene()!, this.el()!, this.store.playhead()) * 100) : 0);

  protected readonly enterOptions = computed<UiSelectOption[]>(() => [
    { value: '', label: 'None' }, ...(this.store.catalog()?.enterPresets ?? []).map((p) => ({ value: p.id, label: p.label })),
  ]);
  protected readonly exitOptions = computed<UiSelectOption[]>(() => [
    { value: '', label: 'None' }, ...(this.store.catalog()?.exitPresets ?? []).map((p) => ({ value: p.id, label: p.label })),
  ]);
  protected readonly easingOptions = computed<UiSelectOption[]>(() =>
    (this.store.catalog()?.easings ?? ['linear']).map((e) => ({ value: e, label: e })));

  protected readonly roleOptions = computed<UiSelectOption[]>(() => [
    { value: '', label: 'Shared by every role' },
    ...(this.store.scene()?.roles ?? []).map((r) => ({ value: r, label: r })),
  ]);

  /** Variables a text can bind, for the Insert menu. */
  protected readonly textVariables = computed<UiSelectOption[]>(() => {
    const catalog = this.store.catalog();
    const scene = this.store.scene();
    const fromCatalog = (catalog?.variables ?? []).filter((v) => v.kind === 'text').map((v) => ({ value: v.path, label: `${v.group} · ${v.label}` }));
    const custom = (scene?.fields ?? []).filter((f) => f.type !== 'url').map((f) => ({ value: f.path, label: `Custom · ${f.label}` }));
    return [{ value: '', label: 'Insert a field…' }, ...fromCatalog, ...custom];
  });

  protected readonly linkOptions = computed<UiSelectOption[]>(() => {
    const scene = this.store.scene();
    const named: Record<string, string> = { 'camera.link': 'Party camera', 'photos.link': 'Photo gallery', 'event.venue.mapLink': 'Venue map' };
    return [
      ...(this.store.catalog()?.linkPaths ?? []).map((p) => ({ value: p, label: named[p] ?? p })),
      ...(scene?.fields ?? []).filter((f) => f.type === 'url').map((f) => ({ value: f.path, label: `Custom · ${f.label}` })),
    ];
  });

  protected readonly slotOptions = computed<UiSelectOption[]>(() => {
    const images = (this.store.catalog()?.variables ?? []).filter((v) => v.kind === 'image').map((v) => ({ value: v.path, label: v.label }));
    const el = this.el();
    const current = el?.slot?.path;
    if (current && !images.some((i) => i.value === current)) images.push({ value: current, label: current.replace(/^event\./, '') });
    return images;
  });

  protected readonly svgColors = computed(() => {
    const el = this.el();
    const scene = this.store.scene();
    if (!el?.svg || !scene) return [];
    return scene.assets[el.svg.asset]?.colors ?? [];
  });

  protected readonly inGroup = computed(() => (this.store.scene() && this.el() ? !!parentOf(this.store.scene()!, this.el()!.id) : false));
  protected readonly blocks = computed(() =>
    [...new Set(this.store.flat().map((f) => f.element.block).filter((b): b is string => !!b))]);

  protected readonly tokenLabel = (token: string) =>
    this.store.catalog()?.variables.find((v) => v.path === token)?.label
    ?? this.store.scene()?.fields.find((f) => f.path === token)?.label
    ?? token;

  protected readonly contentRuns = computed(() => runsToTokens(this.el()?.text?.runs ?? []));

  // ----- Edits -------------------------------------------------------------------------------------

  protected patch(patch: Partial<DesignElement>, key?: string): void {
    const el = this.el();
    if (el) this.store.update(el.id, (e) => ({ ...e, ...patch }), key ? `${el.id}:${key}` : undefined);
  }

  /** x/y/rotate/scale/opacity: at the playhead, keyframe-aware. */
  protected placeValue(prop: 'x' | 'y' | 'rotate' | 'scale' | 'opacity', value: number | null): void {
    const el = this.el();
    const state = this.state();
    if (!el || value === null || !state) return;
    const change = { [prop]: value };
    this.store.place(el.id, change, undefined, `${el.id}:${prop}:${Math.round(this.store.playhead())}`);
  }

  protected size(prop: 'w' | 'h', value: number | null): void {
    if (value === null || value <= 0) return;
    this.patch({ [prop]: value }, prop);
  }

  protected setContent(runs: ReturnType<typeof runsToTokens>): void {
    const el = this.el();
    if (!el?.text) return;
    this.store.update(el.id, (e) => ({ ...e, text: { ...e.text!, runs: tokensToRuns(runs) } }), `${el.id}:content`);
  }

  protected insertVariable(path: string): void {
    if (!path) return;
    this.contentInput()?.insertToken(path);
  }

  protected setTypography(target: 'text' | 'button' | 'dress', style: Typography): void {
    const el = this.el();
    if (!el) return;
    this.store.update(el.id, (e) => ({ ...e, [target]: { ...(e[target] as object), style } }), `${el.id}:type`);
  }

  protected setNested<K extends 'shape' | 'slot' | 'button' | 'dress' | 'image'>(key: K, patch: Partial<NonNullable<DesignElement[K]>>, coalesce?: string): void {
    const el = this.el();
    if (!el) return;
    this.store.update(el.id, (e) => ({ ...e, [key]: { ...(e[key] as object), ...patch } }), coalesce ? `${el.id}:${key}:${coalesce}` : undefined);
  }

  protected setSvgFill(color: string, ref: string | null): void {
    const el = this.el();
    if (!el?.svg) return;
    const fills = { ...el.svg.fills };
    if (ref) fills[color] = ref;
    else delete fills[color];
    this.store.update(el.id, (e) => ({ ...e, svg: { ...e.svg!, fills } }));
  }

  protected setTrackValue(which: 'start' | 'end', value: number | null): void {
    const el = this.el();
    const track = this.track();
    if (!el || !track || value === null) return;
    const start = which === 'start' ? value : track.start;
    const end = which === 'end' ? value : track.end;
    if (end <= start) return;
    this.store.setTrack(el.id, start, end);
  }

  protected setSlotKey(raw: string): void {
    const key = raw.trim().replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : '')).replace(/^[A-Z]/, (c) => c.toLowerCase());
    if (!key) return;
    this.setNested('slot', { path: `event.${key}` }, 'path');
  }

  protected keyframeChanges(k: DesignKeyframe): string {
    const parts: string[] = [];
    if (k.x != null || k.y != null) parts.push('position');
    if (k.rotate != null) parts.push('rotation');
    if (k.scale != null) parts.push('scale');
    if (k.opacity != null) parts.push('opacity');
    return parts.join(', ') || 'holds';
  }

  protected jumpTo(index: number): void {
    const el = this.el();
    const track = this.track();
    if (!el || !track) return;
    this.store.selectedKeyframe.set(index);
    this.store.playhead.set(Math.round(track.start + el.keyframes[index].t * (track.end - track.start)));
  }

  protected async replaceAsset(files: File[]): Promise<void> {
    const file = files[0];
    const el = this.el();
    if (!file || !el) return;
    const before = new Set(Object.keys(this.store.scene()!.assets));
    await this.store.importAsset(file);
    // importAsset adds a new element; swap its asset onto this one and drop the new element.
    const scene = this.store.scene()!;
    const added = Object.keys(scene.assets).find((id) => !before.has(id));
    const newest = this.store.primary();
    if (!added || !newest || newest.id === el.id) return;
    this.store.remove([newest.id]);
    this.store.update(el.id, (e) => (e.svg ? { ...e, svg: { asset: added, fills: {} } } : e.image ? { ...e, image: { ...e.image, asset: added } } : e));
    this.store.select(el.id);
  }

  protected round0(v: number): number {
    return Math.round(v);
  }

  protected round1(v: number): number {
    return Math.round(v * 10) / 10;
  }
}

function round(v: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
