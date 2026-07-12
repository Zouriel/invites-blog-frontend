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

export const WIZARD_STEPS: WizardStep[] = [
  { key: WizardStepKey.Editor, label: 'Design', path: 'editor' },
  { key: WizardStepKey.Roles, label: 'Roles', path: 'roles' },
  { key: WizardStepKey.Guests, label: 'Guests', path: 'guests' },
  { key: WizardStepKey.Venue, label: 'Venue', path: 'venue' },
  { key: WizardStepKey.Inviter, label: 'Inviter', path: 'inviter' },
  { key: WizardStepKey.Delivery, label: 'Delivery', path: 'delivery' },
  { key: WizardStepKey.Payment, label: 'Payment', path: 'payment' },
];

export const DEFAULT_MESSAGE_TEMPLATE =
  "Hi {{name}}, you're invited! Tap your personal link to open the invitation.";
