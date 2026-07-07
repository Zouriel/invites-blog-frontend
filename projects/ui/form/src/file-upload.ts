import { Component, input, output, signal } from '@angular/core';

/** `ui-file-upload` — drag-and-drop / click dropzone. Emits `(filesSelected)`. */
@Component({
  selector: 'ui-file-upload',
  template: `
    <label class="dz" [class.over]="dragOver()" [class.no-radius]="!radius()"
           (dragover)="onDragOver($event)" (dragleave)="dragOver.set(false)" (drop)="onDrop($event)">
      <input type="file" class="native" [multiple]="multiple()" [attr.accept]="accept()" (change)="onPick($event)" />
      <span class="icon" aria-hidden="true">⬆</span>
      <span class="hint"><strong>Click to upload</strong> or drag & drop</span>
      @if (accept()) { <span class="accept">{{ accept() }}</span> }
    </label>
    @if (files().length) {
      <ul class="files">
        @for (f of files(); track f.name) {
          <li><span class="fn">{{ f.name }}</span><span class="sz">{{ size(f.size) }}</span></li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: block; }
    .dz { display: flex; flex-direction: column; align-items: center; gap: var(--ui-space-1);
      padding: var(--ui-space-6) var(--ui-space-4); text-align: center; cursor: pointer;
      border: 1px dashed var(--ui-color-border); border-radius: var(--ui-radius); background: var(--ui-color-surface);
      font-family: var(--ui-font-default); transition: border-color var(--ui-motion-base) var(--ui-ease-standard), background var(--ui-motion-base) var(--ui-ease-standard); }
    .dz.no-radius { border-radius: 0; }
    .dz:hover, .dz.over { border-color: var(--ui-color-primary); background: color-mix(in srgb, var(--ui-color-primary) 8%, var(--ui-color-surface)); }
    .native { position: absolute; width: 0; height: 0; opacity: 0; }
    .icon { font-size: 22px; color: var(--ui-color-text-muted); }
    .hint { font-size: var(--ui-font-size-md); color: var(--ui-color-text); }
    .accept { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .files { margin: var(--ui-space-2) 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; }
    .files li { display: flex; justify-content: space-between; gap: var(--ui-space-3); padding: var(--ui-space-1) var(--ui-space-2);
      background: var(--ui-color-surface-raised); border-radius: 6px; font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); }
    .sz { color: var(--ui-color-text-muted); }
  `,
})
export class UiFileUpload {
  multiple = input(false);
  accept = input<string>();
  radius = input(true);
  filesSelected = output<File[]>();
  protected readonly files = signal<File[]>([]);
  protected readonly dragOver = signal(false);

  protected onDragOver(e: DragEvent): void { e.preventDefault(); this.dragOver.set(true); }
  protected onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragOver.set(false);
    this.commit(Array.from(e.dataTransfer?.files ?? []));
  }
  protected onPick(e: Event): void {
    this.commit(Array.from((e.target as HTMLInputElement).files ?? []));
  }
  private commit(list: File[]): void {
    const files = this.multiple() ? list : list.slice(0, 1);
    this.files.set(files);
    this.filesSelected.emit(files);
  }
  protected size(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
