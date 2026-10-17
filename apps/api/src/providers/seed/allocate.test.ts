import { describe, expect, it } from 'vitest';
import { allocate } from './allocate';
import { between } from './random';

describe('allocate', () => {
  it('splits a number in proportion to the weights', () => {
    expect(allocate(100, [1, 1, 2])).toEqual([25, 25, 50]);
    expect(allocate(10, [0.5, 0.5])).toEqual([5, 5]);
  });

  it('adds up to the total even when the shares are not whole', () => {
    expect(allocate(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(allocate(1, [1, 1, 1])).toEqual([1, 0, 0]);
    expect(allocate(2, [3, 3, 3])).toEqual([1, 1, 0]);
  });

  it('gives a part nothing when its weight is nothing', () => {
    expect(allocate(7, [0, 1, 0])).toEqual([0, 7, 0]);
  });

  it('gives back zeros when there is nothing to split, or nothing to split it by', () => {
    expect(allocate(0, [1, 2])).toEqual([0, 0]);
    expect(allocate(-5, [1, 2])).toEqual([0, 0]);
    expect(allocate(10, [0, 0])).toEqual([0, 0]);
    expect(allocate(10, [])).toEqual([]);
  });

  it('always adds up to the total, and no part is more than one away from its exact share', () => {
    for (let round = 0; round < 300; round += 1) {
      const total = Math.floor(between(`total-${round}`, 0, 5000));
      const count = 1 + Math.floor(between(`count-${round}`, 0, 8));
      const weights = Array.from({ length: count }, (_, index) =>
        between(`weight-${round}-${index}`, 0.01, 1),
      );
      const weightSum = weights.reduce((all, weight) => all + weight, 0);

      const parts = allocate(total, weights);

      expect(parts).toHaveLength(count);
      expect(parts.reduce((all, part) => all + part, 0)).toBe(total);
      parts.forEach((part, index) => {
        const exact = (total * (weights[index] ?? 0)) / weightSum;
        expect(Number.isInteger(part)).toBe(true);
        expect(Math.abs(part - exact)).toBeLessThan(1);
      });
    }
  });
});
