/**
 * `buildPerimeterTable` (contours.ts) replaces "call `contourPerimeter` once per level" with a
 * single cell-first pass, purely for speed — see fmmGrain.ts's `simulationSetup`. This test proves
 * that replacement is lossless by comparing it directly against the brute-force per-level loop it
 * replaced, on real grain geometries (not synthetic grids), across every level each grain's own
 * lookup table actually uses.
 */
import { describe, expect, it } from 'vitest';
import { buildPerimeterTable, contourPerimeter } from '../contours';
import { fastMarchDistance } from '../fmm';
import { MoonBurner } from '../grains/moonBurner';
import { StarGrain } from '../grains/star';
import refMoon from '../__fixtures__/ref_moon.json';
import refStar from '../__fixtures__/ref_star.json';

function buildLevelsAndRegressionMap(grain: MoonBurner | StarGrain, mapDim: number) {
  (grain as unknown as { initGeometry(dim: number): void }).initGeometry(mapDim);
  (grain as unknown as { generateCoreMap(): void }).generateCoreMap();
  const coreMap = (grain as unknown as { coreMap: Float64Array }).coreMap;
  const inDomain = (grain as unknown as { inDomain: Uint8Array }).inDomain;

  const h = 2 / mapDim;
  const regressionMap = fastMarchDistance(coreMap, inDomain, mapDim, h);

  let maxDist = 0;
  for (let i = 0; i < regressionMap.length; i++) {
    if (inDomain[i] === 1 && Number.isFinite(regressionMap[i])) maxDist = Math.max(maxDist, regressionMap[i]);
  }
  const dx = 1 / mapDim;
  const numLevels = maxDist === 0 ? 1 : Math.floor(maxDist / dx) + 2;
  const levels = new Float64Array(numLevels);
  for (let i = 0; i < numLevels; i++) levels[i] = i * dx;

  return { regressionMap, inDomain, levels };
}

describe('buildPerimeterTable matches the brute-force per-level loop exactly', () => {
  it('Moon Burner (ref_moon fixture)', () => {
    const props = (refMoon.motorDict as any).grains[0].properties;
    const grain = MoonBurner.fromProperties(props);
    const mapDim = 250; // Small enough to keep the brute-force comparison loop fast in a unit test.
    const { regressionMap, inDomain, levels } = buildLevelsAndRegressionMap(grain, mapDim);

    const expected = new Float64Array(levels.length);
    for (let i = 0; i < levels.length; i++) expected[i] = contourPerimeter(regressionMap, mapDim, levels[i], inDomain);

    const actual = new Float64Array(levels.length);
    buildPerimeterTable(regressionMap, mapDim, levels, inDomain, actual, 0, mapDim - 1);

    expect(Array.from(actual)).toEqual(Array.from(expected));
  });

  it('Moon Burner, built in row chunks (matches how Motor.runSimulationChunked calls it)', () => {
    const props = (refMoon.motorDict as any).grains[0].properties;
    const grain = MoonBurner.fromProperties(props);
    const mapDim = 250;
    const { regressionMap, inDomain, levels } = buildLevelsAndRegressionMap(grain, mapDim);

    const expected = new Float64Array(levels.length);
    for (let i = 0; i < levels.length; i++) expected[i] = contourPerimeter(regressionMap, mapDim, levels[i], inDomain);

    const actual = new Float64Array(levels.length);
    for (let r = 0; r <= mapDim - 1; r += 17) {
      // Deliberately odd chunk size, to make sure chunk boundaries falling mid-cell-range don't
      // cause a cell to be double-counted or skipped.
      buildPerimeterTable(regressionMap, mapDim, levels, inDomain, actual, r, Math.min(mapDim - 1, r + 16));
    }

    expect(Array.from(actual)).toEqual(Array.from(expected));
  });

  it('Star grain (ref_star fixture)', () => {
    const props = (refStar.motorDict as any).grains[0].properties;
    const grain = StarGrain.fromProperties(props);
    const mapDim = 250;
    const { regressionMap, inDomain, levels } = buildLevelsAndRegressionMap(grain, mapDim);

    const expected = new Float64Array(levels.length);
    for (let i = 0; i < levels.length; i++) expected[i] = contourPerimeter(regressionMap, mapDim, levels[i], inDomain);

    const actual = new Float64Array(levels.length);
    buildPerimeterTable(regressionMap, mapDim, levels, inDomain, actual, 0, mapDim - 1);

    expect(Array.from(actual)).toEqual(Array.from(expected));
  });
});
