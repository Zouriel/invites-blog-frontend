import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton } from '@zouriel/ui/button';
import { UiChipInput, UiFormField, UiInput, UiSelect, type UiSelectOption } from '@zouriel/ui/form';
import { UiSnackbarService } from '@zouriel/ui/dialog';
import { DesignStore } from './design.store';
import { CANVAS_WIDTH, REFERENCE_VIEWPORT, type CustomField } from './model/scene';
import { fieldPath } from './model/fields';

export const FIELD_TYPES: UiSelectOption[] = [
  { value: 'text', label: 'Short text' }, { value: 'textarea', label: 'Long text' }, { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' }, { value: 'url', label: 'Link' }, { value: 'color', label: 'Colour' }, { value: 'select', label: 'Choice' },
];


/**
 * The design's own fields: anything the host should fill in that the platform doesn't already ask for
 * (a gift note, a meal choice, a dress-code line). The event wizard asks for every field the page
 * uses, with its label, type and choices, so a new field is put on the page straight away.
 */
@Component({
  selector: 'app-custom-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiButton, UiChipInput, UiFormField, UiInput, UiSelect],
  template: `
    @if (store.scene(); as scene) {
      <div class="add">
        <ui-form-field label="New field"><ui-input size="sm" [ngModel]="label()" (ngModelChange)="label.set($event ?? '')" placeholder="e.g. Gift note" (keydown.enter)="add()" /></ui-form-field>
        <ui-select size="sm" [options]="types" [ngModel]="type()" (ngModelChange)="type.set($event)" label="Type" />
        <ui-button size="sm" variant="primary" [disabled]="!label().trim()" (click)="add()">Add to the page</ui-button>
      </div>
      <p class="hint">The host fills it in when they set up their event; the page shows what they type.</p>
      @for (f of scene.fields; track f.path; let i = $index) {
        <div class="field">
          <div class="grid2">
            <ui-input size="sm" [ngModel]="f.label" (ngModelChange)="update(i, { label: $event }, 'label')" placeholder="Label" />
            <ui-select size="sm" [options]="types" [ngModel]="f.type" (ngModelChange)="update(i, { type: $event })" label="Type" />
          </div>
          @if (f.type === 'select') {
            <ui-chip-input [ngModel]="f.options ?? []" (ngModelChange)="update(i, { options: $event })" placeholder="Add a choice and press Enter" label="Choices" />
          }
          <ui-input size="sm" [ngModel]="f.sample ?? ''" (ngModelChange)="update(i, { sample: $event || null }, 'sample')" placeholder="Example shown while designing" />
          @if (scene.roles.length) {
            <ui-select size="sm" [options]="roleOptions()" [ngModel]="f.roleScope ?? ''" (ngModelChange)="update(i, { roleScope: $event || null })" label="Filled in by" />
          }
          <div class="actions">
            @if (!used(f.path)) { <span class="unused">Not on the page yet, so the wizard won't ask for it</span> }
            <ui-button size="sm" variant="ghost" (click)="place(f.path)">Add to the page</ui-button>
            <ui-button size="sm" variant="ghost" (click)="remove(i)">Remove</ui-button>
          </div>
        </div>
      }
    }
  `,
  styles: `
    :host { display: grid; gap: var(--ui-space-2); }
    .add { display: grid; grid-template-columns: minmax(0, 1fr) 110px; gap: var(--ui-space-2); align-items: end; }
    .add ui-button { grid-column: 1 / -1; justify-self: start; }
    .hint { margin: 0; font-size: 12px; color: var(--ui-color-text-muted); }
    .field { display: grid; gap: 6px; padding: var(--ui-space-2); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-sm); }
    .grid2 { display: grid; grid-template-columns: minmax(0, 1fr) 110px; gap: 6px; }
    .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
    .unused { flex-basis: 100%; font-size: 12px; color: var(--ui-color-warning); }
  `,
})
export class CustomFieldsComponent {
  protected readonly store = inject(DesignStore);
  private readonly snackbar = inject(UiSnackbarService);
  protected readonly types = FIELD_TYPES;
  protected readonly label = signal('');
  protected readonly type = signal<CustomField['type']>('text');

  protected readonly roleOptions = computed<UiSelectOption[]>(() => [
    { value: '', label: 'The host' }, ...(this.store.scene()?.roles ?? []).map((r) => ({ value: r, label: r })),
  ]);

  /** Whether something on the page uses a field (only those reach the wizard). */
  protected used(path: string): boolean {
    return JSON.stringify(this.store.scene()?.elements ?? []).includes(`"${path}"`);
  }

  protected update(index: number, patch: Partial<CustomField>, coalesce?: string): void {
    this.store.mutate((s) => ({ ...s, fields: s.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) }), coalesce ? `field:${index}:${coalesce}` : undefined);
  }

  protected add(): void {
    const label = this.label().trim();
    const scene = this.store.scene();
    if (!label || !scene) return;
    const path = fieldPath(scene, this.store.catalog()?.variables.map((v) => v.path) ?? [], label);
    const type = this.type();
    this.store.mutate((s) => ({ ...s, fields: [...s.fields, { path, label, type, options: type === 'select' ? [] : null, roleScope: null, sample: null }] }));
    this.label.set('');
    this.place(path);
  }

  /** Puts the field on the page in the middle of the screen, as tapping its chip does. */
  protected place(path: string): void {
    this.store.placeField(path, { x: CANVAS_WIDTH / 2, y: this.store.playhead() + REFERENCE_VIEWPORT / 2 });
  }

  protected remove(index: number): void {
    const path = this.store.scene()!.fields[index].path;
    const inUse = this.used(path);
    this.store.mutate((s) => ({ ...s, fields: s.fields.filter((_, i) => i !== index) }));
    if (inUse) this.snackbar.show({ message: 'Elements still use that field — Check will point them out.', action: { label: 'Undo', run: () => this.store.undo() } });
  }
}
