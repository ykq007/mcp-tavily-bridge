import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'styles.css');

describe('styles.css', () => {
  it('uses token z-index layers for overlays and toasts', () => {
    const css = readFileSync(cssPath, 'utf8');

    const toastWrapBlock = css.match(/\.toastWrap\s*\{[\s\S]*?\}/)?.[0];
    expect(toastWrapBlock).toBeTruthy();
    expect(toastWrapBlock).toMatch(/z-index:\s*var\(--z-toast\);/);

    const dialogOverlayBlock = css.match(/\.dialogOverlay\s*\{[\s\S]*?\}/)?.[0];
    expect(dialogOverlayBlock).toBeTruthy();
    expect(dialogOverlayBlock).toMatch(/z-index:\s*var\(--z-modal\);/);
  });

  it('provides a skip-to-content link style', () => {
    const css = readFileSync(cssPath, 'utf8');
    const block = css.match(/\.skipLink\s*\{[\s\S]*?\}/)?.[0];
    expect(block).toBeTruthy();
  });

  it('has a single canonical token block', () => {
    const css = readFileSync(cssPath, 'utf8');
    const rootBlocks = css.match(/(^|\n):root\s*\{/g) ?? [];
    expect(rootBlocks.length).toBe(1);

    const darkThemeBlocks = css.match(/html\[data-theme='dark'\]\s*\{/g) ?? [];
    expect(darkThemeBlocks.length).toBe(1);
  });

  it('clips long API keys so they cannot overlap action buttons', () => {
    const css = readFileSync(cssPath, 'utf8');

    const block = css.match(/\.keyRevealValue\s*\{[\s\S]*?\}/)?.[0];
    expect(block).toBeTruthy();
    expect(block).toMatch(/display:\s*flex;/);
    expect(block).toMatch(/overflow:\s*hidden;/);
    expect(block).toMatch(/min-width:\s*0;/);
  });
});
