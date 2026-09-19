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
  { label: 'Not set', value: '' },
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Neutral', value: 'neutral' },
];

// Roles first, then theming, then content — each step needs what the one before it decided.
export const WIZARD_STEPS: WizardStep[] = [
  // The event's own first steps come first, so the count starts where the event did.
  { key: WizardStepKey.Event, label: 'Event', path: '' },
  { key: WizardStepKey.Design, label: 'Design', path: '' },
  { key: WizardStepKey.Roles, label: 'Roles', path: 'roles' },
  { key: WizardStepKey.Theming, label: 'Theme', path: 'theming' },
  { key: WizardStepKey.Editor, label: 'Content', path: 'editor' },
  { key: WizardStepKey.Guests, label: 'Guests', path: 'guests' },
  { key: WizardStepKey.Venue, label: 'Venue', path: 'venue' },
  // After the event details are settled: what to ask depends on what the event turned out to be.
  { key: WizardStepKey.Rsvp, label: 'RSVP', path: 'rsvp' },
  { key: WizardStepKey.Inviter, label: 'Inviter', path: 'inviter' },
  { key: WizardStepKey.Photos, label: 'Plan', path: 'photos' },
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
/**
 * The wizard for a design the customer brought themselves.
 *
 * <p>Everything that fills in a template is gone, because an imported design has no fields to fill:
 * no roles to map content to, no theme to override, no content step. <b>Venue and RSVP go with
 * them</b> — and that is the less obvious half. A venue is rendered by a template that binds
 * <code>event.venue.*</code>, and finished artwork binds nothing, so asking for an address collects
 * a value with nowhere to appear. RSVP questions are worse than useless: the reply bar is bolted on
 * by the server, so a host who set questions would be told replies were coming and then see the
 * generic bar their guests actually got.</p>
 *
 * <p>What is left is the part that still means something around any picture: who it goes to, who it
 * is from, and how it is sent.</p>
 */
export const WIZARD_STEPS_IMPORTED: WizardStep[] = [
  { key: WizardStepKey.Event, label: 'Event', path: '' },
  { key: WizardStepKey.Upload, label: 'Upload', path: '' },
  { key: WizardStepKey.Guests, label: 'Guests', path: 'guests' },
  { key: WizardStepKey.Inviter, label: 'Inviter', path: 'inviter' },
  { key: WizardStepKey.Photos, label: 'Plan', path: 'photos' },
  { key: WizardStepKey.Delivery, label: 'Share', path: 'delivery' },
];

/**
 * A save the date: the day, the design and who it goes to. No roles (nothing differs per guest yet)
 * and no RSVP questions (it asks nothing). Its plan step is about emails: a pass bought here moves to
 * the invitation made from it. The venue step stays,
 * optional, as the place: an island or a city is enough this early.
 */
export const WIZARD_STEPS_SAVE_THE_DATE: WizardStep[] = [
  { key: WizardStepKey.Event, label: 'Date', path: '' },
  { key: WizardStepKey.Design, label: 'Design', path: '' },
  { key: WizardStepKey.Theming, label: 'Theme', path: 'theming' },
  { key: WizardStepKey.Editor, label: 'Content', path: 'editor' },
  { key: WizardStepKey.Guests, label: 'Guests', path: 'guests' },
  { key: WizardStepKey.Venue, label: 'Place', path: 'venue' },
  { key: WizardStepKey.Inviter, label: 'From', path: 'inviter' },
  { key: WizardStepKey.Photos, label: 'Plan', path: 'photos' },
  { key: WizardStepKey.Delivery, label: 'Share', path: 'delivery' },
];

/** A save the date made from the host's own picture. */
export const WIZARD_STEPS_SAVE_THE_DATE_IMPORTED: WizardStep[] = [
  { key: WizardStepKey.Event, label: 'Date', path: '' },
  { key: WizardStepKey.Upload, label: 'Upload', path: '' },
  { key: WizardStepKey.Guests, label: 'Guests', path: 'guests' },
  { key: WizardStepKey.Inviter, label: 'From', path: 'inviter' },
  { key: WizardStepKey.Photos, label: 'Plan', path: 'photos' },
  { key: WizardStepKey.Delivery, label: 'Share', path: 'delivery' },
];

export const DEFAULT_SAVE_THE_DATE_MESSAGE =
  'Save the date! Add it to your calendar — the invitation will follow.';

/**
 * Where a wizard page goes next: the step after `key` in this campaign's own flow, as a path under
 * /create/:id. Null at the end.
 */
export function nextWizardPath(steps: WizardStep[], key: WizardStepKey): string | null {
  const at = steps.findIndex((s) => s.key === key);
  for (let i = at + 1; at >= 0 && i < steps.length; i++) if (steps[i].path) return steps[i].path;
  return null;
}

export function wizardStepEyebrow(
  key: WizardStepKey,
  label?: string,
  steps: WizardStep[] = WIZARD_STEPS,
): string {
  // Just the step's name. The step bar says which step of how many, and a number here drifted out
  // of step with it as soon as a step could be skipped.
  const index = steps.findIndex((s) => s.key === key);
  if (index < 0) {
    return label ?? '';
  }
  return label ?? steps[index].label;
}

/**
 * The steps this campaign actually walks. An uploaded design takes the short path; a design with no
 * editable colours or fonts skips Theme, because a page saying "nothing to change here" is a wasted tap.
 */
export function wizardFlowFor(summary: {
  isImported: boolean;
  template: { manifestJson: string } | null;
  kind?: 'invitation' | 'saveTheDate';
}): WizardStep[] {
  const saveTheDate = summary.kind === 'saveTheDate';
  if (summary.isImported) return saveTheDate ? WIZARD_STEPS_SAVE_THE_DATE_IMPORTED : WIZARD_STEPS_IMPORTED;
  const full = saveTheDate ? WIZARD_STEPS_SAVE_THE_DATE : WIZARD_STEPS;
  let themeKeys = 0;
  try {
    themeKeys = (JSON.parse(summary.template?.manifestJson || '{}') as { theme?: { keys?: unknown[] } }).theme?.keys?.length ?? 0;
  } catch {
    themeKeys = 0;
  }
  return themeKeys ? full : full.filter((s) => s.key !== WizardStepKey.Theming);
}
