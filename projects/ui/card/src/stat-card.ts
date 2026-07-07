import { Component, inject, input } from '@angular/core';
import { UI_CONFIG } from 'ui';

/** `ui-stat-card` — KPI tile: label, value, optional delta + icon slot. */
@Component({
  selector: 'ui-stat-card',
  template: `
    <div class="stat" [class.glass]="glass()" [class.no-radius]="!radius()">
      <div class="top">
        <span class="label">{{ label() }}</span>
        <span class="icon"><ng-content select="[stat-icon]" /></span>
      </div>
      <div class="value">{{ value() }}</div>
      @if (delta() !== undefined) {
        <div class="delta" [attr.data-trend]="trend()">
          {{ trend() === 'down' ? '▼' : '▲' }} {{ delta() }}
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .stat { display: flex; flex-direction: column; gap: var(--ui-space-1);
      padding: var(--ui-space-3) var(--ui-space-4);
      background: var(--ui-color-surface); border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius); box-shadow: var(--ui-shadow-1); font-family: var(--ui-font-default); }
    .stat.no-radius { border-radius: 0; }
    .stat.glass { background: var(--ui-glass-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); }
    .top { display: flex; align-items: center; justify-content: space-between; }
    .label { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .icon { color: var(--ui-color-text-muted); }
    .icon:empty { display: none; }
    .value { font-size: 1.6rem; font-weight: 700; color: var(--ui-color-text); line-height: 1.1; }
    .delta { font-size: var(--ui-font-size-sm); font-weight: 600; }
    .delta[data-trend="up"] { color: var(--ui-color-success); }
    .delta[data-trend="down"] { color: var(--ui-color-danger); }
  `,
})
export class UiStatCard {
  private config = inject(UI_CONFIG);
  label = input('');
  value = input<string | number>('');
  delta = input<string | number>();
  trend = input<'up' | 'down'>('up');
  glass = input<boolean>(this.config.glass);
  radius = input<boolean>(this.config.radius);
}
