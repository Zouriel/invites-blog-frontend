import { describe, expect, it } from 'vitest';
import { WizardStepKey } from '../enums/app.enums';
import { nextWizardPath, wizardFlowFor } from './app.constants';

const themed = { manifestJson: JSON.stringify({ theme: { keys: [{ key: 'accent' }] } }) };

/** A save the date walks a shorter wizard: no roles, no RSVP questions, no photos step. */
describe('wizard flow', () => {
  it('skips roles, RSVP and photos for a save the date', () => {
    const keys = wizardFlowFor({ isImported: false, template: themed, kind: 'saveTheDate' }).map((s) => s.key);
    expect(keys).not.toContain(WizardStepKey.Roles);
    expect(keys).not.toContain(WizardStepKey.Rsvp);
    expect(keys).not.toContain(WizardStepKey.Photos);
    expect(keys).toContain(WizardStepKey.Venue);
    expect(keys.at(-1)).toBe(WizardStepKey.Delivery);
  });

  it('keeps the full flow for an invitation', () => {
    const keys = wizardFlowFor({ isImported: false, template: themed, kind: 'invitation' }).map((s) => s.key);
    expect(keys).toContain(WizardStepKey.Roles);
    expect(keys).toContain(WizardStepKey.Photos);
  });

  it('an uploaded save the date goes guests, from, share', () => {
    const flow = wizardFlowFor({ isImported: true, template: null, kind: 'saveTheDate' });
    expect(nextWizardPath(flow, WizardStepKey.Guests)).toBe('inviter');
    expect(nextWizardPath(flow, WizardStepKey.Inviter)).toBe('delivery');
    expect(nextWizardPath(flow, WizardStepKey.Delivery)).toBeNull();
  });
});
