/**
 * Builds the data behind the live grain cross-section preview: the core shape raster plus a
 * handful of evenly-spaced regression contours, computed at a small resolution so it can be
 * recomputed on every form edit without lag. Used by the UI's GrainPreviewCanvas — kept out of the
 * React layer so it stays testable as plain data in/data out.
 */
import { marchContour, type Segment } from './contours';
import { fastMarchDistance } from './fmm';
import type { PerforatedGrain } from './grains/base';

export interface AreaProfilePoint {
  /** Real-unit regression distance (m). */
  regDist: number;
  /** Real-unit face (burning cross-section) area (m^2). */
  faceArea: number;
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
  const numAreaSamples = 30;
  const areaProfile: AreaProfilePoint[] = [];
  for (let k = 0; k <= numAreaSamples; k++) {
    const level = (maxDist * k) / numAreaSamples;
    let count = 0;
    for (let i = 0; i < regressionMap.length; i++) {
      if (inDomain[i] === 1 && regressionMap[i] > level) count++;
    }
    const faceArea = grain.diameter ** 2 * (count / dim ** 2);
    areaProfile.push({ regDist: level * radius, faceArea });
  }

  return { dim, coreMap, inDomain, contours, regressionMap, maxDist, maxRegDist: maxDist * radius, areaProfile };
}

/** Draws one additional contour at `fraction` (0-1) of the preview's max regression depth. */
export function contourAtFraction(preview: GrainPreview, fraction: number): Segment[] {
  const level = preview.maxDist * Math.min(Math.max(fraction, 0), 1);
  return marchContour(preview.regressionMap, preview.dim, level, preview.inDomain).segments;
}
