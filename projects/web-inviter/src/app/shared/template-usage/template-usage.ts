import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { APP_ICONS } from '../icons/app-icons';
import { Template } from '../utils/types/api.types';

/** A template used by fewer events than this is still new, and its card says so. */
export const NEW_TEMPLATE_UNDER = 5;

/**
 * Whether a template wears the "New" badge. A showcase never does: it was made for one person and
 * can't be picked up, so calling it new would advertise something nobody else can use.
 */
export function isNewTemplate(t: Pick<Template, 'useCount' | 'isShowcase'>): boolean {
  return !t.isShowcase && (t.useCount ?? 0) < NEW_TEMPLATE_UNDER;
}

/** "Not used yet", "Used once", "Used 12 times". */
export function usedLabel(count: number): string {
  if (count <= 0) return 'Not used yet';
  if (count === 1) return 'Used once';
  return `Used ${count.toLocaleString('en')} times`;
}

/** How many events use a template, as one quiet line with an icon. */
@Component({
  selector: 'app-template-uses',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent],
  template: `<hugeicons-icon [icon]="icon" [size]="14" [strokeWidth]="1.8" aria-hidden="true" />{{ label() }}`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-1);
      font-size: var(--ui-font-size-sm);
      color: var(--ui-color-text-muted);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class TemplateUsesComponent {
  protected readonly icon = APP_ICONS.guests;
  readonly count = input(0);
  protected readonly label = computed(() => usedLabel(this.count()));
}
