import { describe, expect, it } from 'vitest';
import { simplifyChartLabel } from './chart-labels';

describe('simplifyChartLabel', () => {
  it('keeps recognizable book titles before bibliographic separators', () => {
    expect(simplifyChartLabel('Clean Code: A Handbook of Agile Software Craftsmanship')).toBe('Clean Code');
    expect(simplifyChartLabel('Design Patterns - Elements of Reusable Object-Oriented Software')).toBe('Design Patterns');
    expect(simplifyChartLabel('Python Crash Course (2nd Edition)')).toBe('Python Crash Course');
  });

  it('truncates labels that remain too long after simplification', () => {
    expect(simplifyChartLabel('Very Long Academic Book Title Without Useful Subtitle')).toBe('Very Long Academic Book T...');
  });
});
