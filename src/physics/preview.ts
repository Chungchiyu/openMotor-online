/**
 * Builds the data behind the live grain cross-section preview: the core shape raster plus a
 * handful of evenly-spaced regression contours, computed at a small resolution so it can be
 * recomputed on every form edit without lag. Used by the UI's GrainPreviewCanvas — kept out of the
 * React layer so it stays testable as plain data in/data out.
 */
import { marchContour, type Segment } from './contours';
import { fastMarchDistance } from './fmm';
import type { PerforatedGrain } from './grains/base';
import { segmentSetLength } from './geometry';

export interface AreaProfilePoint {
  /** Real-unit regression distance (m). */
  regDist: number;
  /**
   * Real-unit length (m) of the 2D cross-section's burning contour at this regression depth —
   * matches what the original desktop app's "Area Graph" preview tab actually plots, despite its
   * name: `GrainPreviewWidget._genData` calls `grain.getRegressionData()`, which for every grain
   * (including analytic ones like BATES, which render a one-off FMM raster just for this preview)
   * walks contour levels and sums each one's length via `geometry.length()` — never the `faceArea`
   * array `FmmGrain.generateRegressionMap` computes for the simulation itself.
   *
   * This used to be an actual face area here (cross-sectional area of remaining propellant), which
   * is a fundamentally different curve from the one the original plots — for a BATES grain in
   * particular, perimeter *increases* with regression (the core grows) while face area *decreases*,
   * so the two aren't even monotonic in the same direction. Renamed to `perimeter` to match what
   * it's now computing.
   */
  perimeter: number;
}

export interface GrainPreview {
  dim: number;
  /** 0 = core/void, 1 = propellant, row-major. */
  coreMap: Float64Array;
  inDomain: Uint8Array;
  contours: Segment[][];
  /** Kept so callers (e.g. the results scrubber) can cheaply draw one more contour at an
   * arbitrary regression fraction without re-running the fast marching method. */
  regressionMap: Float64Array;
  maxDist: number;
  /** Real-unit max regression distance (m) — i.e. the wall web thickness. */
  maxRegDist: number;
  /** Face area vs. regression depth, for the "Area Graph" preview tab. */
  areaProfile: AreaProfilePoint[];
}

export function computeGrainPreview(grain: PerforatedGrain, dim = 160, numContours = 6): GrainPreview {
  const { coreMap, inDomain } = grain.getPreviewRaster(dim);
  const h = 2 / dim;
  const regressionMap = fastMarchDistance(coreMap, inDomain, dim, h);

  let maxDist = 0;
  for (let i = 0; i < regressionMap.length; i++) {
    if (inDomain[i] === 1 && Number.isFinite(regressionMap[i])) maxDist = Math.max(maxDist, regressionMap[i]);
  }

  const contours: Segment[][] = [];
  for (let k = 1; k < numContours; k++) {
    const level = (maxDist * k) / numContours;
    contours.push(marchContour(regressionMap, dim, level, inDomain).segments);
  }

  // normalize()/unNormalize() are only defined on FmmGrain, but the relationship (radius = 1 in
  // normalized space) is the same for every PerforatedGrain, so it's reproduced here rather than
  // depending on a method BATES doesn't have.
  const radius = grain.diameter / 2;
  // pixel-grid units -> real length, same scale factor `fmmGrain.ts`'s `mapToLength` uses for the
  // simulation's own burning-perimeter table.
  const toRealLength = grain.diameter / dim;
  const numAreaSamples = 30;
  const areaProfile: AreaProfilePoint[] = [];
  for (let k = 0; k <= numAreaSamples; k++) {
    const level = (maxDist * k) / numAreaSamples;
    // Full (non-restricted) contour extraction + `segmentSetLength`'s boundary filter, matching
    // `getRegressionData()` -> `geometry.length()` — see `segmentSetLength`'s comment for why this
    // is the correct Python code path to mirror here, not `contourPerimeter`'s cell-skipping.
    const { segments } = marchContour(regressionMap, dim, level, inDomain);
    const perimeter = toRealLength * segmentSetLength(segments, dim);
    areaProfile.push({ regDist: level * radius, perimeter });
  }

  return { dim, coreMap, inDomain, contours, regressionMap, maxDist, maxRegDist: maxDist * radius, areaProfile };
}

/**
 * Real-unit regression distance (m) -> this preview's own normalized regression-map units, clamped
 * to its valid range.
 *
 * Uses the same direct diameter-based conversion the Python original uses (`mapDist = regDist /
 * (0.5 * diameter)`, see `resultsWidget.py`'s `updateGrainTab`) rather than re-deriving it from a
 * "fraction of wallWeb": that indirection multiplied a fraction computed against the real
 * simulation's `wallWeb` by this preview's own independently-computed (lower-resolution) `maxDist`
 * — two different approximations of the same quantity — and left the highlighted contour visibly
 * out of position, worst right near burnout.
 */
export function regDistToLevel(preview: GrainPreview, regDist: number, diameter: number): number {
  return Math.min(Math.max(regDist / (0.5 * diameter), 0), preview.maxDist);
}

/**
 * Draws the contour at a given normalized level (see `regDistToLevel`).
 *
 * Note that at `level === preview.maxDist` exactly, no contour can exist — marching squares needs
 * some cell corners above the level and some at or below it, and nothing in the field is above its
 * own true maximum. Callers wanting a "how much is burned" indicator should pair this with an
 * erosion-based fill (thresholding `preview.regressionMap` directly, as `GrainPreviewCanvas` does)
 * rather than relying on this line alone all the way to full burnout.
 */
export function contourAtLevel(preview: GrainPreview, level: number): Segment[] {
  return marchContour(preview.regressionMap, preview.dim, level, preview.inDomain).segments;
}
