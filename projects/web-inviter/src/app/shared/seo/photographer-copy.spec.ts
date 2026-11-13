import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
const join = (...parts: string[]) => parts.join('/');

/**
 * Owner copy rule (2026-11-13): Photographer is described by what it includes, never as "Studio without the AI
 * designer", "everything Studio has but/except the AI designer" or "Studio minus AI". This reads every page, template
 * and public text file and refuses any sentence that names Photographer together with such a phrase. Code comments
 * (lines starting with //, * or <!--) are left out: they are for developers.
 */
// Tests run from the workspace root (or the project folder): the same lookup keyframe-audit.spec uses.
const ROOT = existsSync('projects/web-inviter/src') ? 'projects/web-inviter' : '.';
const BAD = /(without|but|except|minus)\s+(the\s+)?(ai|ask ai)\b/i;
/** "Photographer does not / doesn't ..." (owner, 2026-11-13: the AI designer line in Terms and FAQ says it comes with Studio). */
const NEGATIVE = /Photographer(\s*\(?[^.)]*\)?)?\s+(does not|doesn't|do not|don't)\b|not with Photographer|Photographer does(n't| not)/i;

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.(ts|html|txt)$/.test(name) && !name.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

describe('Photographer copy', () => {
  it('never describes Photographer as Studio without the AI designer', () => {
    const list = [...files(join(ROOT, 'src')), ...files(join(ROOT, 'public'))];
    expect(list.length).toBeGreaterThan(50);
    const offending: string[] = [];
    for (const f of list) {
      const lines = readFileSync(f, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/**') || t.startsWith('<!--')) return;
        // The sentence around it: this line and its neighbours (copy wraps across lines).
        const around = lines.slice(Math.max(0, i - 2), i + 3).join(' ');
        if (BAD.test(line) && /Photographer/.test(around) && !/\(with or without the AI designer\)/.test(line))
          offending.push(`${f}:${i + 1}: ${t}`);
        else if (NEGATIVE.test(line)) offending.push(`${f}:${i + 1}: ${t}`);
      });
    }
    expect(offending).toEqual([]);
  });
});
