import { contactIssues, isValidEmail, phoneKey } from './contact';

describe('guest contact checks', () => {
  it('accepts blank and ordinary addresses, refuses obvious typos', () => {
    expect(isValidEmail('')).toBe(true);
    expect(isValidEmail('  ')).toBe(true);
    expect(isValidEmail('aisha+rsvp@example.co.uk')).toBe(true);
    expect(isValidEmail('aisha@example')).toBe(false);
    expect(isValidEmail('aisha example.com')).toBe(false);
    expect(isValidEmail('aisha@@example.com')).toBe(false);
  });

  it('compares phone numbers by their digits', () => {
    expect(phoneKey('+960 777-1234')).toBe(phoneKey('9607771234'));
  });

  it('flags duplicates within the list, ignoring case and blanks', () => {
    const issues = contactIssues([
      { email: 'Ali@Example.com', phone: '' },
      { email: 'ali@example.com ', phone: '+960 7771234' },
      { email: '', phone: '960-777-1234' },
      { email: 'bad@', phone: '' },
      { email: '', phone: '' },
    ]);

    expect(issues.map((i) => i.duplicateEmail)).toEqual([true, true, false, false, false]);
    expect(issues.map((i) => i.duplicatePhone)).toEqual([false, true, true, false, false]);
    expect(issues.map((i) => i.invalidEmail)).toEqual([false, false, false, true, false]);
  });
});
