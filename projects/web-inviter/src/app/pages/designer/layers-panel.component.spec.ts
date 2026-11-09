import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { UiTree } from '@zouriel/ui/data';
import { UiSnackbarService } from '@zouriel/ui/dialog';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiService } from '../../shared/api/api.service';
import { DesignStore } from './design.store';
import { LayersPanelComponent } from './layers-panel.component';
import type { DesignElement, DesignScene } from './model/scene';

const shape = (id: string, name: string): DesignElement => ({
  id, name, type: 'shape', x: 0, y: 0, w: 20, h: 20, rotate: 0, scale: 1, opacity: 1, keyframes: [],
  shape: { kind: 'rect', sides: 4, fill: '#000000', stroke: null, strokeWidth: 0, radius: 0 },
});

const group = (id: string, name: string, children: DesignElement[]): DesignElement => ({
  id, name, type: 'group', x: 0, y: 0, w: 100, h: 100, rotate: 0, scale: 1, opacity: 1, keyframes: [], children,
});

const scene = (elements: DesignElement[]): DesignScene => ({
  schema: 3, canvas: {}, theme: [], fonts: [], roles: [], fields: [], elements, assets: {}, stage: true, length: 1000,
});

describe('Layers panel', () => {
  let store: DesignStore;
  let snackbar: UiSnackbarService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DesignStore, { provide: ApiService, useValue: {} }] });
    store = TestBed.inject(DesignStore);
    snackbar = TestBed.inject(UiSnackbarService);
  });

  function render(elements: DesignElement[]) {
    store.scene.set(scene(elements));
    const fixture = TestBed.createComponent(LayersPanelComponent);
    fixture.detectChanges();
    return fixture;
  }

  const rows = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[role="treeitem"]')];
  const values = (root: HTMLElement) => rows(root).map((row) => row.dataset['value']);
  const button = (root: HTMLElement, label: string) =>
    root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

  it('lists front-most layers first, nests group children, and mutes hidden layers', () => {
    store.hidden.set(new Set(['middle']));
    store.selection.set(['child-back']);
    const fixture = render([
      shape('back', 'Back'),
      shape('middle', 'Middle'),
      group('group', 'Group', [shape('child-back', 'Child back'), shape('child-front', 'Child front')]),
      shape('front', 'Front'),
    ]);
    const root = fixture.nativeElement as HTMLElement;

    expect(values(root)).toEqual(['front', 'group', 'child-front', 'child-back', 'middle', 'back']);
    expect(root.querySelector('[data-value="group"]')?.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('[data-value="middle"] > .row')?.classList.contains('muted')).toBe(true);
  });

  it('writes multi-selection from the tree and reflects store selection in selectedValues', () => {
    const fixture = render([shape('back', 'Back'), shape('middle', 'Middle'), shape('front', 'Front')]);
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLElement>('[data-value="front"] > .row')!.click();
    root.querySelector<HTMLElement>('[data-value="back"] > .row')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    fixture.detectChanges();

    expect(store.selection()).toEqual(['front', 'back']);
    const tree = fixture.debugElement.query(By.directive(UiTree)).componentInstance as UiTree;
    expect(tree.selectedValues()).toEqual(['front', 'back']);

    store.selection.set(['middle', 'back']);
    fixture.detectChanges();
    expect(tree.selectedValues()).toEqual(['middle', 'back']);
    expect(root.querySelector('[data-value="middle"]')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('[data-value="back"]')?.getAttribute('aria-selected')).toBe('true');
  });

  it('expands every ancestor of the selection', () => {
    store.selection.set(['leaf']);
    const fixture = render([
      group('outer', 'Outer', [group('inner', 'Inner', [shape('leaf', 'Leaf')])]),
    ]);
    const root = fixture.nativeElement as HTMLElement;

    expect(values(root)).toEqual(['outer', 'inner', 'leaf']);
    expect(root.querySelector('[data-value="outer"]')?.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('[data-value="inner"]')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('hides and locks with the row buttons without changing selection', () => {
    store.selection.set(['front']);
    const fixture = render([shape('back', 'Back'), shape('front', 'Front')]);
    const root = fixture.nativeElement as HTMLElement;

    button(root, 'Hide Back').click();
    fixture.detectChanges();
    expect([...store.hidden()]).toEqual(['back']);
    expect(store.selection()).toEqual(['front']);

    button(root, 'Lock Back').click();
    fixture.detectChanges();
    expect(store.scene()!.elements[0].locked).toBe(true);
    expect(store.selection()).toEqual(['front']);

    button(root, 'Show Back').click();
    button(root, 'Unlock Back').click();
    fixture.detectChanges();
    expect(store.hidden().has('back')).toBe(false);
    expect(store.scene()!.elements[0].locked).toBe(false);
    expect(store.selection()).toEqual(['front']);
  });

  it('turns front-first move indexes into paint-order moves at the top and in the middle', () => {
    const fixture = render([shape('back', 'Back'), shape('middle', 'Middle'), shape('front', 'Front')]);
    const component = fixture.componentInstance as any;

    component.move({ value: 'back', parent: null, index: 0 });
    expect(store.scene()!.elements.map((el) => el.id)).toEqual(['middle', 'front', 'back']);

    store.scene.set(scene([shape('back', 'Back'), shape('middle', 'Middle'), shape('front', 'Front')]));
    component.move({ value: 'back', parent: null, index: 1 });
    expect(store.scene()!.elements.map((el) => el.id)).toEqual(['middle', 'back', 'front']);
  });

  it('rejects a move to another parent and explains why', () => {
    const original = [shape('back', 'Back'), group('group', 'Group', [shape('child', 'Child')])];
    const fixture = render(original);

    (fixture.componentInstance as any).move({ value: 'back', parent: 'group', index: 0 });

    expect(store.scene()!.elements.map((el) => el.id)).toEqual(['back', 'group']);
    expect(store.scene()!.elements[1].children!.map((el) => el.id)).toEqual(['child']);
    expect(snackbar.current()?.message).toBe('Layers can be reordered within their own group. Ungroup to move one out.');
  });
});
