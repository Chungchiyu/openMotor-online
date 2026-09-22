/**
 * Base class for grains whose regression must be found numerically because their core cross
 * section isn't a simple closed-form shape (star, finocyl, etc. — only the star grain is wired up
 * for this MVP). Ported from the `FmmGrain` class in motorlib/grain.py.
 *
 * Performance note: the Python original recomputes the burning perimeter via marching squares on
 * every simulation timestep (cheap enough in Cython, too slow to repeat that often in JS). This
 * port instead builds a lookup table of perimeter-vs-regression-depth once, during
 * `simulationSetup`, and linearly interpolates it during the run — same approach the Python code
 * already uses for face area, just extended to cover perimeter too. See fmm.ts and contours.ts for
 * the numerical building blocks.
 */
import { contourPerimeter } from '../contours';
import { fastMarchDistance } from '../fmm';
import { PerforatedGrain } from './base';

interface Lookup {
  levels: Float64Array;
  values: Float64Array;
}

function interpLookup({ levels, values }: Lookup, x: number): number {
  const n = levels.length;
  if (n === 0) return 0;
  if (x <= levels[0]) return values[0];
  if (x >= levels[n - 1]) return values[n - 1];
  // Levels are sorted ascending and evenly spaced, so binary search is straightforward.
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (levels[mid] <= x) lo = mid;
    else hi = mid;
  }
  const t = (x - levels[lo]) / (levels[hi] - levels[lo]);
  return values[lo] + (values[hi] - values[lo]) * t;
}

export abstract class FmmGrain extends PerforatedGrain {
  mapDim = 1001;
  protected mapX: Float64Array = new Float64Array(0);
  protected mapY: Float64Array = new Float64Array(0);
  protected inDomain: Uint8Array = new Uint8Array(0);
  protected coreMap: Float64Array = new Float64Array(0);
  protected regressionMap: Float64Array | null = null;
  private faceAreaTable: Lookup | null = null;
  private perimeterTable: Lookup | null = null;

  /** Real-unit value -> normalized coordinate ([-1, 1] spans the full diameter's radius). */
  normalize(value: number): number {
    return value / (0.5 * this.diameter);
  }

  /** Normalized coordinate -> real-unit value. */
  unNormalize(value: number): number {
    return (value / 2) * this.diameter;
  }

  mapToLength(value: number): number {
    return this.diameter * (value / this.mapDim);
  }

  mapToArea(value: number): number {
    return this.diameter ** 2 * (value / this.mapDim ** 2);
  }

  protected initGeometry(mapDim: number): void {
    if (mapDim < 64) throw new Error('Map dimension must be 64 or larger to get good results');
    this.mapDim = mapDim;
    const n = mapDim * mapDim;
    this.mapX = new Float64Array(n);
    this.mapY = new Float64Array(n);
    this.inDomain = new Uint8Array(n);
    this.coreMap = new Float64Array(n).fill(1);
    for (let r = 0; r < mapDim; r++) {
      const y = -1 + (2 * r) / (mapDim - 1);
      for (let c = 0; c < mapDim; c++) {
        const x = -1 + (2 * c) / (mapDim - 1);
        const i = r * mapDim + c;
        this.mapX[i] = x;
        this.mapY[i] = y;
        this.inDomain[i] = x * x + y * y <= 1 ? 1 : 0;
      }
    }
    this.regressionMap = null;
    this.faceAreaTable = null;
    this.perimeterTable = null;
  }

  /** Fills `this.coreMap` using `this.mapX`/`this.mapY`. A 0 marks the initial core (burn-front seed). */
  protected abstract generateCoreMap(): void;

  simulationSetup(config: { mapDim: number }): void {
    this.initGeometry(config.mapDim);
    this.generateCoreMap();
    this.generateRegressionMap();
  }

  private generateRegressionMap(): void {
    const h = 2 / this.mapDim;
    const regressionMap = fastMarchDistance(this.coreMap, this.inDomain, this.mapDim, h);
    this.regressionMap = regressionMap;

    let maxDist = 0;
    for (let i = 0; i < regressionMap.length; i++) {
      if (this.inDomain[i] === 1 && Number.isFinite(regressionMap[i])) {
        maxDist = Math.max(maxDist, regressionMap[i]);
      }
    }
    this.wallWeb = this.unNormalize(maxDist);

    const numLevels = Math.min(250, this.mapDim);
    const levels = new Float64Array(numLevels);
    const faceAreaValues = new Float64Array(numLevels);
    const perimeterValues = new Float64Array(numLevels);
    for (let i = 0; i < numLevels; i++) {
      const level = maxDist === 0 ? 0 : (maxDist * i) / (numLevels - 1);
      levels[i] = level;

      let count = 0;
      for (let j = 0; j < regressionMap.length; j++) {
        if (this.inDomain[j] === 1 && regressionMap[j] > level) count++;
      }
      faceAreaValues[i] = this.mapToArea(count);
      perimeterValues[i] = this.mapToLength(contourPerimeter(regressionMap, this.mapDim, level, this.inDomain));
    }
    this.faceAreaTable = { levels, values: faceAreaValues };
    this.perimeterTable = { levels, values: perimeterValues };
  }

  getCorePerimeter(regDist: number): number {
    if (!this.perimeterTable) throw new Error('perimeterTable is missing');
    return interpLookup(this.perimeterTable, this.normalize(regDist));
  }

  getFaceArea(regDist: number): number {
    if (!this.faceAreaTable) throw new Error('faceAreaTable is missing');
    const mapDist = this.normalize(regDist);
    if (mapDist >= this.faceAreaTable.levels[this.faceAreaTable.levels.length - 1]) return 0; // Past burnout
    return interpLookup(this.faceAreaTable, mapDist);
  }

  getPreviewRaster(dim: number): { coreMap: Float64Array; inDomain: Uint8Array } {
    this.initGeometry(dim);
    this.generateCoreMap();
    return { coreMap: this.coreMap, inDomain: this.inDomain };
  }
}
