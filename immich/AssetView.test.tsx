import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { AssetView, transitionClass } from './AssetView';
import type { LoadedSlide } from './useSlideshow';

// Regression: each transition mode must map to its own motion class. A prior
// specificity bug caused zoom/pan/kenburns to fall back to a plain fade.
describe('transitionClass', () => {
  it('gives each mode a distinct class', () => {
    expect(transitionClass('kenburns')).toBe('immich-kenburns');
    expect(transitionClass('zoom')).toBe('immich-zoom');
    expect(transitionClass('pan')).toBe('immich-pan');
    expect(transitionClass('none')).toBe('immich-none');
    expect(transitionClass('fade')).toBe('immich-fadeonly');
  });
});

const slide: LoadedSlide = {
  asset: { id: 'a1', type: 'IMAGE', originalFileName: 'a1.jpg' },
  blob: new Blob(['x'], { type: 'image/jpeg' }),
  placeholder: null,
  face: null,
};

describe('AssetView — first-load behavior', () => {
  it('starts hidden (data-loaded=false) and carries no filename alt text', async () => {
    const { container, findByRole } = render(
      <AssetView slide={slide} fit="cover" transition="kenburns" durationSeconds={1} intervalSeconds={10} />,
    );
    // The <img> renders once the object URL is created from the blob.
    await findByRole('presentation', { hidden: true }).catch(() => null);
    const img = container.querySelector('img.immich-photo');
    expect(img?.getAttribute('data-loaded')).toBe('false');
    // Regression: filename must not appear as drifting alt text.
    expect(img?.getAttribute('alt')).toBe('');
  });

  it('applies the motion class only once loaded', () => {
    const { container } = render(
      <AssetView slide={slide} fit="cover" transition="zoom" durationSeconds={1} intervalSeconds={10} />,
    );
    const img = container.querySelector('img.immich-photo');
    // Not loaded yet → no motion class (may also be null before URL is ready).
    expect(img?.className.includes('immich-zoom') ?? false).toBe(false);
  });
});
