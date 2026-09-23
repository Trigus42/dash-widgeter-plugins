import { describe, it, expect } from 'vitest';
import { fittedFontSize, MIN_FONT_PX } from './fit';

/**
 * The overflow bug was: a wider string (HH:MM:SS) kept the same font size and
 * clipped. fittedFontSize is the pure core of the fix — shrink when the measured
 * text is wider than the box, keep the height-budget size when it fits.
 */
describe('fittedFontSize', () => {
  it('keeps the height-budget size when text already fits', () => {
    expect(fittedFontSize(100, 200, 350)).toBe(100);
  });

  it('shrinks proportionally when text overflows the width', () => {
    // 488px wide at 100px font, box 350px → 100 * 350/488 ≈ 71.
    expect(fittedFontSize(100, 488, 350)).toBe(71);
  });

  it('never goes below the legibility floor', () => {
    expect(fittedFontSize(100, 100000, 350)).toBe(MIN_FONT_PX);
  });
});
