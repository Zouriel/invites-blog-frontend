import { DestroyRef, Directive, ElementRef, Injector, afterEveryRender, inject, input } from '@angular/core';
import type { UiTourService } from '@zouriel/ui/guidance';

/**
 * Names the buttons a library component draws for itself (ui-tabs' tabs, ui-bottom-nav's items) as
 * tour anchors, by position: `[appItemAnchors]="['dash.guests', 'dash.celebrants']"`. Those buttons
 * can't carry `uiTourAnchor` themselves, so this registers them with the library's UiTourService the
 * way the directive would. A null entry leaves that item unnamed.
 *
 * Without `appItemAnchorsSelector` the items are the tabs of the FIRST tablist inside the host, so
 * the tabs of a ui-tabs nested in one of its panels aren't counted.
 */
@Directive({ selector: '[appItemAnchors]' })
export class ItemAnchorsDirective {
  /** Per item: an anchor id, several (one element can answer to more than one), or null. */
  readonly ids = input.required<readonly (string | readonly string[] | null)[]>({ alias: 'appItemAnchors' });
  readonly selector = input<string | null>(null, { alias: 'appItemAnchorsSelector' });
  /** Name the first tablist itself (the whole strip) rather than its tabs. */
  readonly whole = input(false, { alias: 'appItemAnchorsStrip' });

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  /** Loaded on first use: the bottom bar carries this, and the tour (its panel and overlay) is not
   *  worth putting in every page's first download for a few anchors. */
  private tours: UiTourService | null = null;
  private registered: { id: string; el: HTMLElement; off: () => void }[] = [];
  private gone = false;

  constructor() {
    void import('@zouriel/ui/guidance').then((m) => {
      if (this.gone) return;
      this.tours = this.injector.get(m.UiTourService);
      this.sync();
    });
    afterEveryRender(() => this.sync());
    inject(DestroyRef).onDestroy(() => {
      this.gone = true;
      this.clear();
    });
  }

  private items(): HTMLElement[] {
    const root = this.host.nativeElement as HTMLElement;
    const sel = this.selector();
    if (sel) return Array.from(root.querySelectorAll<HTMLElement>(sel));
    if (this.whole()) {
      const list = root.querySelector<HTMLElement>('[role="tablist"]');
      return list ? [list] : [];
    }
    const list = root.querySelector('[role="tablist"]');
    return list ? Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]')) : [];
  }

  private sync(): void {
    const tours = this.tours;
    if (!tours) return;
    const items = this.items();
    const want = this.ids().flatMap((ids, i) =>
      items[i] ? (Array.isArray(ids) ? ids : ids ? [ids as string] : []).map((id) => ({ id, el: items[i] })) : [],
    );
    const same =
      want.length === this.registered.length &&
      want.every((w, i) => w.id === this.registered[i].id && w.el === this.registered[i].el);
    if (same) return;
    this.clear();
    this.registered = want.map((w) => ({ ...w, off: tours.register(w.id, w.el) }));
  }

  private clear(): void {
    this.registered.forEach((r) => r.off());
    this.registered = [];
  }
}
