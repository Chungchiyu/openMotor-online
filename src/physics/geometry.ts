/**
 * Geometry helper functions used throughout the motor calculations.
 * Ported from motorlib/geometry.py.
 */

export function circleArea(dia: number): number {
  return (dia / 2) ** 2 * Math.PI;
}

export function circlePerimeter(dia: number): number {
  return dia * Math.PI;
}

export function circleDiameterFromArea(area: number): number {
  return 2 * (area / Math.PI) ** 0.5;
}

export function tubeArea(dia: number, height: number): number {
  return dia * Math.PI * height;
}

export function cylinderArea(dia: number, height: number): number {
  return 2 * circleArea(dia) + tubeArea(dia, height);
}

export function cylinderVolume(dia: number, height: number): number {
  return height * circleArea(dia);
}

export function frustumLateralSurfaceArea(diameterA: number, diameterB: number, length: number): number {
  const radiusA = diameterA / 2;
  const radiusB = diameterB / 2;
  return Math.PI * (radiusA + radiusB) * (Math.abs(radiusA - radiusB) ** 2 + length ** 2) ** 0.5;
}

export function frustumVolume(diameterA: number, diameterB: number, length: number): number {
  const radiusA = diameterA / 2;
  const radiusB = diameterB / 2;
  return Math.PI * (length / 3) * (radiusA ** 2 + radiusA * radiusB + radiusB ** 2);
}

export function splitFrustum(
  diameterA: number,
  diameterB: number,
  length: number,
  splitPosition: number,
): [[number, number, number], [number, number, number]] {
  const splitDiameter = diameterA + (diameterB - diameterA) * (splitPosition / length);
  return [
    [diameterA, splitDiameter, splitPosition],
    [splitDiameter, diameterB, length - splitPosition],
  ];
}

/**
 * Total length of a polyline contour (an array of [row, col] points in image space), omitting any
 * segments within `tolerance` of the edge of a circle with diameter `mapSize`.
 */
export function contourLength(contour: number[][], mapSize: number, tolerance = 3): number {
  if (contour.length === 0) return 0;
  let total = 0;
  const center = mapSize / 2;
  const radiusLimit = mapSize / 2 - tolerance;
  for (let i = 0; i < contour.length; i++) {
    const prev = contour[(i - 1 + contour.length) % contour.length];
    const cur = contour[i];
    const segLength = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    const radius = Math.hypot(cur[0] - center, cur[1] - center);
    if (radius < radiusLimit) {
      total += segLength;
    }
  }
  return total;
}

/**
 * Same idea as `contourLength`, but for a contour represented as a flat list of disconnected
 * `{a, b}` edges (as `marchContour` in contours.ts returns) rather than an ordered polyline —
 * `find_perimeter(..., including_contours=True)` in the Python original returns ordered vertex
 * lists, and `geometry.length()` filters by walking pairs of *consecutive* vertices, checking only
 * the later one of each pair against the boundary. Since our edges aren't chained into an ordered
 * walk, the natural equivalent is to require *both* endpoints of a given edge to clear the same
 * boundary check — a symmetric version of the same test, not a different one. Used by the "Area
 * Graph" preview tab, matching `GrainPreviewWidget._genData`'s use of `geometry.length()` rather
 * than the burning-perimeter lookup table's own cell-skipping approach (`contourPerimeter` in
 * contours.ts, which reproduces a *different* Python code path — the Cython fast path used for the
 * simulation itself, not this preview).
 */
export function segmentSetLength(segments: { a: [number, number]; b: [number, number] }[], mapSize: number, tolerance = 3): number {
  const center = mapSize / 2;
  const radiusLimit = mapSize / 2 - tolerance;
  let total = 0;
  for (const { a, b } of segments) {
    const radiusA = Math.hypot(a[0] - center, a[1] - center);
    const radiusB = Math.hypot(b[0] - center, b[1] - center);
    if (radiusA < radiusLimit && radiusB < radiusLimit) {
      total += Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
  }
  return total;
}

/** Removes any points in a contour that fall within `tolerance` of a circle of diameter `mapSize`. */
export function cleanContour(contour: number[][], mapSize: number, tolerance: number): number[][] {
  const center = mapSize / 2;
  const radiusLimit = mapSize / 2 - tolerance;
  return contour.filter(([r, c]) => Math.hypot(r - center, c - center) < radiusLimit);
}

export function dist(point1: [number, number], point2: [number, number]): number {
  return Math.hypot(point1[0] - point2[0], point1[1] - point2[1]);
}
