import { photoWindowClosedLine } from './photo-window';

describe('photoWindowClosedLine', () => {
  it('names the last open day on the event clock, not the midnight it ended', () => {
    // Ends at midnight going into 30 August in Malé (19:00 UTC on the 29th): the last open day is the 29th.
    const line = photoWindowClosedLine('2026-08-29T19:00:00Z', 'Indian/Maldives');
    expect(line).toContain('29');
    expect(line).toContain('2026');
    expect(line).not.toContain('30');
    expect(line).toMatch(/^Photo window closed on .+\. Guests can still view the album\.$/);
  });

  it('still says it closed without a date', () => {
    expect(photoWindowClosedLine(null, null)).toBe('Photo window closed. Guests can still view the album.');
  });
});
