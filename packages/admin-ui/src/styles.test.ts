import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'styles.css');

describe('styles.css', () => {
  it('clips long API keys so they cannot overlap action buttons', () => {
    const css = readFileSync(cssPath, 'utf8');

    const block = css.match(/\.keyRevealValue\s*\{[\s\S]*?\}/)?.[0];
    expect(block).toBeTruthy();
    expect(block).toMatch(/display:\s*flex;/);
    expect(block).toMatch(/overflow:\s*hidden;/);
    expect(block).toMatch(/min-width:\s*0;/);
  });
});

