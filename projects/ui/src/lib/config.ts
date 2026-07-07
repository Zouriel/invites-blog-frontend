import { InjectionToken, Provider, inject } from '@angular/core';

/**
 * Global library configuration. Consumers set defaults once via
 * `provideUiConfig({ ... })` in `app.config.ts`; every component reads these
 * defaults from {@link UI_CONFIG} and lets its own inputs override per-instance.
 */
export interface UiConfig {
  /** Default glass treatment on surface components (card, window, modal, …). */
  glass: boolean;
  /** Rounded corners on/off. */
  radius: boolean;
  /** Fallback font-family applied when a component's `font` input is unset. */
  defaultFont: string;
  /** Master animation switch — disables all component animations when false. */
  animations: boolean;
}

export const UI_CONFIG = new InjectionToken<UiConfig>('UI_CONFIG', {
  providedIn: 'root',
  factory: () => defaultUiConfig,
});

export const defaultUiConfig: UiConfig = {
  glass: false,
  radius: true,
  defaultFont: 'var(--ui-font-default)',
  animations: true,
};

export function provideUiConfig(config: Partial<UiConfig> = {}): Provider {
  return { provide: UI_CONFIG, useValue: { ...defaultUiConfig, ...config } };
}

/**
 * Convenience accessor for components. Always returns a fully-resolved config
 * (falls back to {@link defaultUiConfig} when no provider is present).
 */
export function injectUiConfig(): UiConfig {
  return inject(UI_CONFIG, { optional: true }) ?? defaultUiConfig;
}
