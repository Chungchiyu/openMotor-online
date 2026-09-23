import { describe, expect, it } from 'vitest';
import { savgolFilter } from '../numerics';
import savgolFixture from '../__fixtures__/savgol.json';

describe('savgolFilter', () => {
  it('exactly reproduces a polynomial at or below its order, including at the edges', () => {
    const { windowLength, polyorder, input } = savgolFixture.quadratic;
    const result = savgolFilter(Float64Array.from(input), windowLength, polyorder);
    for (let i = 0; i < input.length; i++) {
      expect(result[i]).toBeCloseTo(input[i], 9);
    }
  });

  it('matches scipy.signal.savgol_filter on face-area-shaped data (window 31, polyorder 5)', () => {
    const { windowLength, polyorder, input, output } = savgolFixture.faceAreaLike;
    const result = savgolFilter(Float64Array.from(input), windowLength, polyorder);
    for (let i = 0; i < output.length; i++) {
      expect(result[i]).toBeCloseTo(output[i], 6);
    }
  });

  it('leaves data shorter than the window unfiltered rather than throwing', () => {
    const input = Float64Array.from([5, 3, 1]);
    const result = savgolFilter(input, 31, 5);
    expect(Array.from(result)).toEqual(Array.from(input));
  });
});
