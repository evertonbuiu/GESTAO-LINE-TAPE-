import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(process.cwd(), 'src');

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (
      /\.(ts|tsx)$/.test(full) &&
      !full.includes('integrations/supabase/types') &&
      !full.includes(`${join('src', 'test')}`)
    )
      acc.push(full);
  }
  return acc;
}

const files = walk(SRC);

describe('profiles table access (least privilege)', () => {
  const usages = files
    .map((f) => ({ f, src: readFileSync(f, 'utf8') }))
    .filter(({ src }) => /from\(['"]profiles['"]\)/.test(src));

  it('only reads profiles scoped to a specific user', () => {
    for (const { f, src } of usages) {
      const idx = src.indexOf("from('profiles')");
      const chunk = src.slice(idx, idx + 300);
      expect(chunk, `${f} must scope profiles query by user_id/id`).toMatch(/\.eq\(['"](user_id|id)['"]/);
    }
  });

  it('never selects the email column from profiles in the client', () => {
    for (const { f, src } of usages) {
      const idx = src.indexOf("from('profiles')");
      const chunk = src.slice(idx, idx + 200);
      expect(chunk, `${f} must not select email from profiles`).not.toMatch(/select\([^)]*email/);
    }
  });
});

describe('collaborator/driver selectors regression', () => {
  it('people selectors do not depend on the profiles table', () => {
    const selectorFiles = files.filter((f) =>
      /(Collaborators|DailyRates|InterstateTransport|EventCollaborators)\.tsx$/.test(f)
    );
    expect(selectorFiles.length).toBeGreaterThan(0);
    for (const f of selectorFiles) {
      const src = readFileSync(f, 'utf8');
      expect(src, `${f} should read people from collaborators/workers`).not.toMatch(/from\(['"]profiles['"]\)/);
    }
  });
});
