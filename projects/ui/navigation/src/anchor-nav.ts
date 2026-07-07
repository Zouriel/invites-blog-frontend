import { DOCUMENT } from '@angular/common';
import { Component, NgZone, OnDestroy, OnInit, inject, input, signal } from '@angular/core';

export interface UiAnchorItem {
  id: string;
  label: string;
}

/** `ui-anchor-nav` — scrollspy navigation: highlights the section in view and scrolls to it on click. */
@Component({
  selector: 'ui-anchor-nav',
  template: `
    <nav class="an" aria-label="On this page">
      <ul>
        @for (item of items(); track item.id) {
          <li>
            <button type="button" class="link" [class.active]="item.id === active()" (click)="scrollTo(item.id)">{{ item.label }}</button>
          </li>
        }
      </ul>
    </nav>
  `,
  styles: `
    :host { display: block; }
    ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; border-left: 1px solid var(--ui-color-border); }
    .link { display: block; width: 100%; text-align: left; padding: var(--ui-space-1) var(--ui-space-3);
      background: none; border: none; border-left: 2px solid transparent; margin-left: -1px; cursor: pointer;
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .link:hover { color: var(--ui-color-text); }
    .link.active { color: var(--ui-color-primary); border-left-color: var(--ui-color-primary); }
    .link:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
  `,
})
export class UiAnchorNav implements OnInit, OnDestroy {
  private doc = inject(DOCUMENT);
  private zone = inject(NgZone);
  items = input<UiAnchorItem[]>([]);
  /** CSS scroll-margin offset applied when scrolling to a section. */
  offset = input(80);
  protected readonly active = signal<string>('');
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) this.zone.run(() => this.active.set(entry.target.id));
      }
    }, { rootMargin: `-${this.offset()}px 0px -65% 0px` });
    queueMicrotask(() => {
      for (const item of this.items()) {
        const el = this.doc.getElementById(item.id);
        if (el) this.observer!.observe(el);
      }
    });
  }
  ngOnDestroy(): void { this.observer?.disconnect(); }

  protected scrollTo(id: string): void {
    this.doc.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.active.set(id);
  }
}
