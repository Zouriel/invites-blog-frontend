/**
 * Typed handles for the shared animation classes defined in
 * `ui/styles/animations.css`. Use these with Angular's modern CSS enter/leave
 * bindings so durations/easings stay token-driven and reduced-motion-safe:
 *
 *   import { UI_ANIM } from 'ui';
 *   <div [animate.enter]="UI_ANIM.scale.enter" [animate.leave]="UI_ANIM.scale.leave">
 */
export const UI_ANIM = {
  fade: { enter: 'ui-fade-enter', leave: 'ui-fade-leave' },
  scale: { enter: 'ui-scale-enter', leave: 'ui-scale-leave' },
  slideUp: { enter: 'ui-slide-up-enter', leave: 'ui-slide-up-leave' },
  slideDown: { enter: 'ui-slide-down-enter', leave: 'ui-slide-down-leave' },
  slideLeft: { enter: 'ui-slide-left-enter', leave: 'ui-slide-left-leave' },
  slideRight: { enter: 'ui-slide-right-enter', leave: 'ui-slide-right-leave' },
  sheet: { enter: 'ui-sheet-enter', leave: 'ui-sheet-leave' },
  backdrop: { enter: 'ui-backdrop-enter', leave: 'ui-backdrop-leave' },
  window: { enter: 'ui-window-open-enter', leave: 'ui-window-close-leave', dock: 'ui-window-dock' },
} as const;
