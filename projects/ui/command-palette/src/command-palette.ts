import { Component, computed, effect, ElementRef, input, model, output, signal, viewChild } from '@angular/core';

export interface UiCommand {
  label: string;
  value: string;
  group?: string;
  icon?: string;
  shortcut?: string;
  keywords?: string;
}

/**
 * `ui-command-palette` — ⌘K-style fuzzy command launcher. Bind `[(open)]`,
 * pass `commands`, listen to `(run)`. Filters as you type; Arrow/Enter to run.
 */
@Component({
  selector: 'ui-command-palette',
  template: `
    @if (open()) {
      <div class="cp-backdrop" (click)="open.set(false)" animate.enter="ui-backdrop-enter" animate.leave="ui-backdrop-leave"></div>
      <div class="cp-wrap" (keydown)="onKey($event)">
        <div class="cp" role="dialog" aria-modal="true" aria-label="Command palette"
             animate.enter="ui-scale-enter" animate.leave="ui-scale-leave">
          <input #input class="cp-input" [value]="query()" [attr.placeholder]="placeholder()"
                 (input)="onInput($event)" role="combobox" aria-expanded="true" aria-controls="cp-list" />
          <ul class="cp-list" id="cp-list" role="listbox">
            @for (c of filtered(); track c.value; let i = $index) {
              <li role="option" class="cp-item" [class.active]="i === active()" [attr.aria-selected]="i === active()"
                  (mousedown)="$event.preventDefault(); pick(c)" (mouseenter)="active.set(i)">
                @if (c.icon) { <span class="ci">{{ c.icon }}</span> }
                <span class="cl">{{ c.label }}</span>
                @if (c.group) { <span class="cg">{{ c.group }}</span> }
                @if (c.shortcut) { <kbd class="ck">{{ c.shortcut }}</kbd> }
              </li>
            } @empty {
              <li class="cp-empty">No results</li>
            }
          </ul>
        </div>
      </div>
    }
  `,
  styles: `
    .cp-backdrop { position: fixed; inset: 0; z-index: var(--ui-z-overlay); background: rgba(0,0,0,0.5); }
    .cp-wrap { position: fixed; inset: 0; z-index: var(--ui-z-overlay); display: flex; justify-content: center; align-items: flex-start; padding-top: 12vh; pointer-events: none; }
    .cp { pointer-events: auto; width: min(560px, 92vw); background: var(--ui-color-surface-raised);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); box-shadow: var(--ui-shadow-3); overflow: hidden; font-family: var(--ui-font-default); }
    .cp-input { width: 100%; box-sizing: border-box; height: 46px; padding: 0 var(--ui-space-4); border: none;
      border-bottom: 1px solid var(--ui-color-border); background: transparent; color: var(--ui-color-text); font-size: var(--ui-font-size-lg); outline: none; }
    .cp-list { margin: 0; padding: var(--ui-space-1); list-style: none; max-height: 320px; overflow: auto; }
    .cp-item { display: flex; align-items: center; gap: var(--ui-space-2); padding: var(--ui-space-2) var(--ui-space-3); border-radius: 6px; cursor: pointer; color: var(--ui-color-text); }
    .cp-item.active { background: color-mix(in srgb, var(--ui-color-primary) 18%, transparent); }
    .ci { width: 18px; text-align: center; }
    .cl { flex: 1; font-size: var(--ui-font-size-md); }
    .cg { font-size: 12px; color: var(--ui-color-text-muted); }
    .ck { font-family: var(--ui-font-mono); font-size: 11px; padding: 1px 5px; border: 1px solid var(--ui-color-border); border-radius: 4px; color: var(--ui-color-text-muted); }
    .cp-empty { padding: var(--ui-space-4); text-align: center; color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
  `,
})
export class UiCommandPalette {
  open = model(false);
  commands = input<UiCommand[]>([]);
  placeholder = input('Type a command or search…');
  run = output<UiCommand>();

  protected readonly query = signal('');
  protected readonly active = signal(0);
  private input = viewChild<ElementRef<HTMLInputElement>>('input');

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.commands();
    return this.commands().filter((c) => `${c.label} ${c.group ?? ''} ${c.keywords ?? ''}`.toLowerCase().includes(q));
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.query.set('');
        this.active.set(0);
        queueMicrotask(() => this.input()?.nativeElement.focus());
      }
    });
  }

  protected onInput(e: Event): void { this.query.set((e.target as HTMLInputElement).value); this.active.set(0); }
  protected onKey(e: KeyboardEvent): void {
    const items = this.filtered();
    if (e.key === 'ArrowDown') { e.preventDefault(); this.active.update((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.active.update((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const c = items[this.active()]; if (c) this.runCommand(c); }
    else if (e.key === 'Escape') { e.preventDefault(); this.open.set(false); }
  }
  protected pick(c: UiCommand): void { this.runCommand(c); }
  private runCommand(c: UiCommand): void { this.run.emit(c); this.open.set(false); }
}
