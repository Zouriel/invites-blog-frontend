import { Component, input } from '@angular/core';

/** `ui-grain` — animated film-grain overlay. Mount once near the app root (fixed, non-interactive). */
@Component({
  selector: 'ui-grain',
  template: `<div class="grain" aria-hidden="true" [style.opacity]="opacity()"></div>`,
  styles: `
    :host { display: contents; }
    .grain { position: fixed; inset: -50%; pointer-events: none; z-index: 9; mix-blend-mode: overlay;
      background-image: url("data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='3'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.85'/></svg>");
      animation: ui-grain-shift 8s steps(8) infinite; }
    @keyframes ui-grain-shift {
      0% { transform: translate(0,0); } 20% { transform: translate(-2%,1%); } 40% { transform: translate(1%,-2%); }
      60% { transform: translate(-1%,2%); } 80% { transform: translate(2%,-1%); } 100% { transform: translate(0,0); }
    }
    @media (prefers-reduced-motion: reduce) { .grain { display: none; } }
  `,
})
export class UiGrain {
  opacity = input(0.06);
}
