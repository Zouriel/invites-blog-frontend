import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '../../../shared/api/api.service';
import { DesignStore } from '../design.store';
import type { DesignParticles, DesignScene } from '../model/scene';
import { ParticlesFieldComponent } from './particles-field.component';

const scene = (): DesignScene => ({
  schema: 3,
  canvas: {},
  theme: [
    { key: 'accent', label: 'Accent', value: '#d45c72' },
    { key: 'text', label: 'Text', value: '#1c2430' },
  ],
  fonts: [], roles: [], fields: [], elements: [], assets: {},
});

describe('Particles field', () => {
  let store: DesignStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DesignStore, { provide: ApiService, useValue: {} }] });
    store = TestBed.inject(DesignStore);
    store.scene.set(scene());
  });

  function render(value: DesignParticles | null = null) {
    const fixture = TestBed.createComponent(ParticlesFieldComponent);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('fill', 'theme:accent');
    fixture.detectChanges();
    return fixture;
  }

  const button = (root: HTMLElement, label: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')]
      .find((candidate) => candidate.getAttribute('aria-label') === label || candidate.textContent?.trim() === label)!;

  it('selects None for an empty value and Dust starts with only its kind', () => {
    const fixture = render();
    const root = fixture.nativeElement as HTMLElement;
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);

    expect(button(root, 'None').getAttribute('aria-pressed')).toBe('true');
    button(root, 'Dust').click();

    expect(changed).toHaveBeenLastCalledWith({ kind: 'dust' });
  });

  it('emits null when None is picked', () => {
    const fixture = render({ kind: 'dust' });
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);

    button(fixture.nativeElement, 'None').click();

    expect(changed).toHaveBeenCalledWith(null);
  });

  it('keeps all settings when switching to Stars', () => {
    const value: DesignParticles = { kind: 'dust', amount: 0.2, size: 0.85, speed: 0.4, pointer: 'gather', color: 'theme:accent' };
    const fixture = render(value);
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);

    button(fixture.nativeElement, 'Stars').click();

    expect(changed).toHaveBeenCalledWith({ ...value, kind: 'stars' });
    expect(value).toEqual({ kind: 'dust', amount: 0.2, size: 0.85, speed: 0.4, pointer: 'gather', color: 'theme:accent' });
  });

  it('sets Amount to Lots', () => {
    const fixture = render({ kind: 'snow' });
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);

    button(fixture.nativeElement, 'Lots').click();

    expect(changed).toHaveBeenCalledWith({ kind: 'snow', amount: 0.85 });
  });

  it('sets the pointer effect to Move away', () => {
    const fixture = render({ kind: 'fireflies', size: 0.2 });
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);

    button(fixture.nativeElement, 'Move away').click();

    expect(changed).toHaveBeenCalledWith({ kind: 'fireflies', size: 0.2, pointer: 'avoid' });
  });

  it('does not show particle options when value is null', () => {
    const root = render().nativeElement as HTMLElement;

    expect(root.querySelector('ui-segmented')).toBeNull();
    expect(root.querySelector('app-color-ref-field')).toBeNull();
    expect(root.querySelector('ui-panel-section')).toBeNull();
    expect(root.textContent).not.toContain('Always drifting on its own');
  });

  it('emits a typed Fine-tune Speed value', () => {
    const fixture = render({ kind: 'bokeh', amount: 0.3 });
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);
    button(fixture.nativeElement, 'Fine-tune (exact values)').click();
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[aria-label="Speed exact value"]')!;

    input.value = '0.65';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(changed).toHaveBeenCalledWith({ kind: 'bokeh', amount: 0.3, speed: 0.65 });
  });
});
