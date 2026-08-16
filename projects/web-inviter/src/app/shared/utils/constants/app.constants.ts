import { WizardStepKey } from '../enums/app.enums';

export type SelectOption = { label: string; value: string };

export type WizardStep = {
  key: WizardStepKey;
  label: string;
  path: string;
};

export const COUNTRY_OPTIONS: SelectOption[] = [
  { label: 'Maldives (MV)', value: 'MV' },
  { label: 'India (IN)', value: 'IN' },
  { label: 'Sri Lanka (LK)', value: 'LK' },
  { label: 'UAE (AE)', value: 'AE' },
  { label: 'United Kingdom (GB)', value: 'GB' },
  { label: 'United States (US)', value: 'US' },
];

export const GENDER_OPTIONS: SelectOption[] = [
  { label: '—', value: '' },
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Neutral', value: 'neutral' },
];

// Roles first, then theming, then content — each step needs what the one before it decided.
export const WIZARD_STEPS: WizardStep[] = [
  { key: WizardStepKey.Roles, label: 'Roles', path: 'roles' },
  { key: WizardStepKey.Theming, label: 'Theme', path: 'theming' },
  { key: WizardStepKey.Editor, label: 'Content', path: 'editor' },
  { key: WizardStepKey.Guests, label: 'Guests', path: 'guests' },
  { key: WizardStepKey.Venue, label: 'Venue', path: 'venue' },
  { key: WizardStepKey.Inviter, label: 'Inviter', path: 'inviter' },
  { key: WizardStepKey.Delivery, label: 'Share', path: 'delivery' },
];

export const DEFAULT_MESSAGE_TEMPLATE =
  "You're warmly invited! Tap below to open your personal invitation.";

/**
 * The eyebrow a wizard page shows, derived from WIZARD_STEPS rather than written out by hand —
 * these drifted out of step with the stepper the moment the order changed (two pages both claimed
 * "Step 3"), and a number that contradicts the progress indicator is worse than none.
 *
 * `label` overrides the step's own name for a sub-page, e.g. the guest review screen.
 */
export function wizardStepEyebrow(key: WizardStepKey, label?: string): string {
  const index = WIZARD_STEPS.findIndex((s) => s.key === key);
  if (index < 0) {
    return label ?? '';
  }
  return `Step ${index + 1} · ${label ?? WIZARD_STEPS[index].label}`;
}
