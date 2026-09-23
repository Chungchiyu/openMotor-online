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
import { yieldToEventLoop } from '../asyncUtils';
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
    const { regressionMap, levels, faceAreaValues } = this.prepareRegressionTables();
    const perimeterValues = new Float64Array(levels.length);
    for (let i = 0; i < levels.length; i++) {
      perimeterValues[i] = this.mapToLength(contourPerimeter(regressionMap, this.mapDim, levels[i], this.inDomain));
    }
    this.faceAreaTable = { levels, values: faceAreaValues };
    this.perimeterTable = { levels, values: perimeterValues };
  }

  /**
   * Chunked counterpart to `simulationSetup`, for `Motor.runSimulationChunked` to call instead.
   * Everything up through the face-area table (`prepareRegressionTables`) is fast — one pass over
   * the grid plus a histogram, see its own comment — so it stays synchronous; only the perimeter
   * table needs chunking, since it re-runs marching squares over the *whole* grid once per level
   * (see `contourPerimeter`) and a Moon Burner-shaped grain can need close to `mapDim` levels.
   * Yields are gated by wall-clock time rather than a fixed number of levels, matching the timestep
   * loop's own `maxMsBetweenYields` pattern in motor.ts, since a fixed count would either yield too
   * often for a small mapDim or not often enough for a large one.
   */
  async simulationSetupChunked(config: { mapDim: number }, onProgress: (fraction: number) => void, isCancelled: () => boolean): Promise<boolean> {
    this.initGeometry(config.mapDim);
    this.generateCoreMap();
    const { regressionMap, levels, faceAreaValues } = this.prepareRegressionTables();

    const perimeterValues = new Float64Array(levels.length);
    const maxMsBetweenYields = 40;
    let lastYield = Date.now();
    for (let i = 0; i < levels.length; i++) {
      perimeterValues[i] = this.mapToLength(contourPerimeter(regressionMap, this.mapDim, levels[i], this.inDomain));
      if (Date.now() - lastYield >= maxMsBetweenYields) {
        onProgress(i / levels.length);
        // eslint-disable-next-line no-await-in-loop
        await yieldToEventLoop();
        if (isCancelled()) return false;
        lastYield = Date.now();
      }
    }

    this.faceAreaTable = { levels, values: faceAreaValues };
    this.perimeterTable = { levels, values: perimeterValues };
    return true;
  }

  /**
   * The part of setup shared between the synchronous and chunked paths: runs fast marching once
   * and builds the level grid + face-area table from it. Cheap enough (one grid pass plus a
   * histogram — see the face-area loop below) to never need chunking on its own; only the
   * perimeter table built from `levels`/`regressionMap` afterward does.
   */
  private prepareRegressionTables(): { regressionMap: Float64Array; levels: Float64Array; faceAreaValues: Float64Array } {
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

    // Sample at the same per-pixel granularity the Python original uses (dx = 1/mapDim), rather
    // than a fixed 250-point table — the burning perimeter and face area both change increasingly
    // fast near burnout (the last few percent of regression can span a third of the table's
    // levels), so a coarse fixed table under-resolves exactly the region that matters most for
    // burnout timing. Matching Python's resolution here is what closed most of the remaining gap
    // in end-to-end burn time/ISP after fixing the FMM solver's order (see fmm.ts).
    const dx = 1 / this.mapDim;
    const numLevels = maxDist === 0 ? 1 : Math.floor(maxDist / dx) + 2;
    const levels = new Float64Array(numLevels);
    for (let i = 0; i < numLevels; i++) levels[i] = i * dx;

    // Face area only needs a count of cells beyond each level, which a single histogram pass over
    // the map turns into O(mapDim^2 + numLevels) instead of O(numLevels * mapDim^2) — the naive
    // "recount from scratch per level" cost that made a finer table for perimeter alone affordable
    // but not for both.
    const faceAreaValues = new Float64Array(numLevels);
    {
      const bins = new Float64Array(numLevels + 1);
      for (let j = 0; j < regressionMap.length; j++) {
        if (this.inDomain[j] !== 1) continue;
        const v = regressionMap[j];
        // Seed cells (the core itself, v === 0 exactly) never satisfy "v > level" for any
        // level >= 0, so they must be excluded rather than falling into bin 0 alongside the
        // near-zero (but genuinely positive) propellant cells right at the burn front.
        if (!Number.isFinite(v) || v <= 0) continue;
        const bin = Math.min(numLevels, Math.max(0, Math.floor(v / dx)));
        bins[bin]++;
      }
      // suffix[i] = number of cells with regressionMap > levels[i]. Bin i holds values in
      // [i*dx, (i+1)*dx), all of which are > levels[i] = i*dx except the single exact boundary
      // point, so bin i itself belongs in the count for level i (not just the bins above it).
      let suffix = 0;
      for (let i = numLevels; i >= 0; i--) suffix += bins[i];
      for (let i = 0; i < numLevels; i++) {
        faceAreaValues[i] = this.mapToArea(suffix);
        suffix -= bins[i];
      }
    }

    return { regressionMap, levels, faceAreaValues };
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
