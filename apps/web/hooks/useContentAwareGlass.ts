'use client';

import { useEffect, useState, useCallback } from 'react';

/**
 * Samples the luminance of content scrolling under the glass header.
 * Returns `true` when dark content is underneath (glass should lighten),
 * `false` when light content is underneath (glass can darken).
 *
 * Updates a CSS variable `--glass-adaptive-opacity` on :root for use
 * in CSS without re-renders.
 */
export function useContentAwareGlass(sampleY = 80): boolean {
  const [isDarkContent, setIsDarkContent] = useState(false);

  const sample = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Walk elements at the horizontal centre, just below the header
    const elements = document.elementsFromPoint(Math.floor(window.innerWidth / 2), sampleY);

    for (const el of elements) {
      // Skip the header itself and its descendants
      if ((el as HTMLElement).closest?.('header')) continue;

      const style = window.getComputedStyle(el);
      const bg = style.backgroundColor;

      // Skip transparent layers
      if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;

      const match = bg.match(/\d+(\.\d+)?/g);
      if (!match || match.length < 3) continue;

      const [r, g, b] = match.map(Number);
      // Relative luminance (WCAG formula)
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const dark = luminance < 0.45;

      // Update CSS variable for CSS-driven adaptation
      document.documentElement.style.setProperty(
        '--glass-adaptive-opacity',
        dark ? '0.72' : '0.55'
      );

      setIsDarkContent(dark);
      return;
    }
  }, [sampleY]);

  useEffect(() => {
    sample();
    window.addEventListener('scroll', sample, { passive: true });
    // Also re-sample when dark mode class changes
    const observer = new MutationObserver(sample);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      window.removeEventListener('scroll', sample);
      observer.disconnect();
    };
  }, [sample]);

  return isDarkContent;
}
