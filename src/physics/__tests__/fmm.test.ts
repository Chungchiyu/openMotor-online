import { describe, expect, it } from 'vitest';
import { fastMarchDistance } from '../fmm';
import fixtures from '../__fixtures__/skfmm_fmm_cases.json';

type Case = { dim: number; core: number[][]; dist: number[][] };

function toFlat(dim: number, grid: number[][]): Float64Array {
  const out = new Float64Array(dim * dim);
  for (let r = 0; r < dim; r++) for (let c = 0; c < dim; c++) out[r * dim + c] = grid[r][c];
  return out;
}

function runCase(name: string, tol: number) {
  const { dim, core, dist } = fixtures[name as keyof typeof fixtures] as Case;
  const coreMap = toFlat(dim, core);
  const inDomain = new Uint8Array(dim * dim).fill(1);
  const result = fastMarchDistance(coreMap, inDomain, dim, 1.0);

  let maxAbsErr = 0;
  let worst = { r: -1, c: -1 };
  for (let r = 0; r < dim; r++) {
    for (let c = 0; c < dim; c++) {
      const py = dist[r][c];
      const ts = result[r * dim + c];
      const err = Math.abs(ts - py);
      if (err > maxAbsErr) {
        maxAbsErr = err;
        worst = { r, c };
      }
    }
  }
  expect(maxAbsErr, `worst mismatch at ${JSON.stringify(worst)} (case ${name})`).toBeLessThan(tol);
}

describe('fastMarchDistance matches skfmm.distance() exactly (no domain mask)', () => {
  it('single centered seed: plain radial distance', () => {
    runCase('radial', 1e-9);
  });

  it('two seeds equidistant along a ridge: exact-tie batch freezing must match skfmm', () => {
    runCase('tie_ridge', 1e-9);
  });

  it('six seeds in a symmetric hexagon: wavefronts merge like adjacent star grain points', () => {
    runCase('hex_merge', 1e-9);
  });
});
