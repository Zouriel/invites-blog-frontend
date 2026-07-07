import { Injectable, signal } from '@angular/core';

export type UiDockSide = 'left' | 'right' | 'top' | 'bottom' | 'maximize' | null;

/** A window's imperative surface, registered with the manager for coordination. */
export interface UiWindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UiWindowHandle {
  id: string;
  minimize(): void;
  restore(): void;
  dock(side: UiDockSide): void;
  focus(): void;
  setBounds(bounds: UiWindowBounds): void;
}

let windowSeq = 0;

/**
 * `UiWindowManager` — tracks open windows, focus order, and z-index stacking,
 * and exposes bulk operations (minimize all, tile). Each `ui-window` registers
 * itself on init.
 */
@Injectable({ providedIn: 'root' })
export class UiWindowManager {
  private readonly baseZ = 1100; // matches --ui-z-window
  private readonly topZ = signal(this.baseZ);
  private readonly registry = new Map<string, UiWindowHandle>();

  /** Currently focused window id (front-most). */
  readonly focusedId = signal<string | null>(null);
  /** Number of registered windows (reactive, for UIs that show a count). */
  readonly count = signal(0);

  nextId(): string {
    return `ui-window-${windowSeq++}`;
  }

  register(handle: UiWindowHandle): void {
    this.registry.set(handle.id, handle);
    this.count.set(this.registry.size);
    this.focusedId.set(handle.id);
  }

  unregister(id: string): void {
    this.registry.delete(id);
    this.count.set(this.registry.size);
    if (this.focusedId() === id) this.focusedId.set(null);
  }

  /** Allocate the next z-index and mark the window focused. */
  bringToFront(id: string): number {
    const z = this.topZ() + 1;
    this.topZ.set(z);
    this.focusedId.set(id);
    return z;
  }

  focus(id: string): void {
    this.registry.get(id)?.focus();
  }

  dock(id: string, side: UiDockSide): void {
    this.registry.get(id)?.dock(side);
  }

  minimizeAll(): void {
    for (const h of this.registry.values()) h.minimize();
  }

  restoreAll(): void {
    for (const h of this.registry.values()) h.restore();
  }

  /** Tile all registered windows into a grid covering the viewport. */
  tile(): void {
    const handles = [...this.registry.values()];
    const n = handles.length;
    if (!n) return;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.floor(vw / cols);
    const h = Math.floor(vh / rows);
    handles.forEach((handle, i) => {
      const cx = i % cols;
      const cy = Math.floor(i / cols);
      handle.setBounds({ x: cx * w, y: cy * h, width: w, height: h });
    });
  }
}
