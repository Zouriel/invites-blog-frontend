import { describe, expect, it } from 'vitest';
import { isNewTemplate, usedLabel } from './template-usage';

describe('template usage', () => {
  it('marks a template new until five events use it', () => {
    expect(isNewTemplate({ useCount: 0 })).toBe(true);
    expect(isNewTemplate({ useCount: 4 })).toBe(true);
    expect(isNewTemplate({ useCount: 5 })).toBe(false);
    expect(isNewTemplate({})).toBe(true);
  });

  it('never calls a one-of-a-kind showcase new', () => {
    expect(isNewTemplate({ useCount: 1, isShowcase: true })).toBe(false);
  });

  it('says how often it was used in words', () => {
    expect(usedLabel(0)).toBe('Not used yet');
    expect(usedLabel(1)).toBe('Used once');
    expect(usedLabel(1234)).toBe('Used 1,234 times');
  });
});
