import { describe, expect, it } from 'vitest';
import { heatAlpha } from './heat';

describe('heatAlpha', () => {
  it('shades more where more of the cohort came back', () => {
    expect(heatAlpha(0.1)).toBeLessThan(heatAlpha(0.3));
    expect(heatAlpha(0.3)).toBeLessThan(heatAlpha(0.5));
  });

  it('never goes below the floor or above the ceiling that keeps text readable', () => {
    expect(heatAlpha(0)).toBeCloseTo(0.06);
    expect(heatAlpha(-1)).toBeCloseTo(0.06);
    expect(heatAlpha(0.5)).toBeCloseTo(0.45);
    expect(heatAlpha(1)).toBeCloseTo(0.45);
  });
});
