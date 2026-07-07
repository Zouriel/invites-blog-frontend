import { Component, computed, input, output, signal } from '@angular/core';

export interface UiFileNode {
  name: string;
  type: 'file' | 'dir';
  /** File URL (for files), used when opening into a viewer. */
  url?: string;
  /** MIME/extension hint. */
  kind?: string;
  children?: UiFileNode[];
}

/** `ui-file-explorer` — directory browser: breadcrumb path + list view, typed icons, open-into-viewer. */
@Component({
  selector: 'ui-file-explorer',
  template: `
    <div class="fx">
      <nav class="crumbs" aria-label="Path">
        <button type="button" class="crumb" (click)="goTo(-1)">{{ root().name || 'root' }}</button>
        @for (seg of trail(); track $index) {
          <span class="sep" aria-hidden="true">/</span>
          <button type="button" class="crumb" (click)="goTo($index)">{{ seg.name }}</button>
        }
      </nav>
      <ul class="list" role="list">
        @for (node of entries(); track node.name) {
          <li>
            <button type="button" class="row" [class.dir]="node.type === 'dir'"
                    (click)="node.type === 'dir' ? enter(node) : open.emit(node)">
              <span class="icon" aria-hidden="true">{{ iconFor(node) }}</span>
              <span class="name">{{ node.name }}</span>
              @if (node.type === 'dir') { <span class="chev" aria-hidden="true">›</span> }
            </button>
          </li>
        } @empty {
          <li class="empty">Empty folder</li>
        }
      </ul>
    </div>
  `,
  styles: `
    :host { display: block; }
    .fx { border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; font-family: var(--ui-font-default); }
    .crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; padding: var(--ui-space-2) var(--ui-space-3);
      background: var(--ui-color-surface-raised); border-bottom: 1px solid var(--ui-color-border); }
    .crumb { background: none; border: none; color: var(--ui-color-text-muted); cursor: pointer; font: inherit; font-size: var(--ui-font-size-sm); padding: 2px 4px; border-radius: 4px; }
    .crumb:hover { color: var(--ui-color-text); background: var(--ui-color-surface); }
    .sep { color: var(--ui-color-text-muted); }
    .list { margin: 0; padding: var(--ui-space-1); list-style: none; max-height: 280px; overflow: auto; }
    .row { display: flex; align-items: center; gap: var(--ui-space-2); width: 100%; padding: var(--ui-space-2) var(--ui-space-3);
      background: none; border: none; border-radius: 6px; cursor: pointer; color: var(--ui-color-text); font: inherit; text-align: left; }
    .row:hover { background: var(--ui-color-surface-raised); }
    .row:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .icon { font-size: 15px; }
    .name { flex: 1; font-size: var(--ui-font-size-md); }
    .chev { color: var(--ui-color-text-muted); }
    .empty { padding: var(--ui-space-4); text-align: center; color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
  `,
})
export class UiFileExplorer {
  root = input.required<UiFileNode>();
  open = output<UiFileNode>();
  private readonly path = signal<UiFileNode[]>([]);

  protected readonly trail = computed(() => this.path());
  protected readonly entries = computed(() => {
    const dir = this.path().at(-1) ?? this.root();
    const kids = [...(dir.children ?? [])];
    return kids.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
  });

  protected enter(node: UiFileNode): void { this.path.update((p) => [...p, node]); }
  protected goTo(index: number): void {
    this.path.update((p) => (index < 0 ? [] : p.slice(0, index + 1)));
  }
  protected iconFor(node: UiFileNode): string {
    if (node.type === 'dir') return '📁';
    const k = (node.kind || node.name.split('.').pop() || '').toLowerCase();
    if (/(png|jpe?g|gif|webp|svg|image)/.test(k)) return '🖼️';
    if (/(mp4|webm|mov|video)/.test(k)) return '🎬';
    if (/(mp3|wav|ogg|audio)/.test(k)) return '🎵';
    if (/pdf/.test(k)) return '📕';
    if (/(ts|js|json|css|html|code)/.test(k)) return '📜';
    return '📄';
  }
}
