/**
 * Rasterizes an arbitrary closed polygon (given as ordered vertices in the same normalized [-1, 1]
 * coordinate space fmmGrain.ts's `mapX`/`mapY` use) onto a core map, for the Custom Grain's core
 * shape. Standalone geometry, independent of the marching-squares code in contours.ts.
 */

export type Point = readonly [number, number];

/** Signed area via the shoelace formula; magnitude is the true area regardless of winding order. */
export function polygonArea(polygon: readonly Point[]): number {
  let sum = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % n];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/** Even-odd (ray casting) point-in-polygon test. */
export function pointInPolygon(polygon: readonly Point[], x: number, y: number): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const crosses = yi > y !== yj > y;
    if (crosses) {
      const xCross = xi + ((y - yi) / (yj - yi)) * (xj - xi);
      if (x < xCross) inside = !inside;
    }
  }
  return inside;
}

function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
    (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d1 = d(p3[0], p3[1], p4[0], p4[1], p1[0], p1[1]);
  const d2 = d(p3[0], p3[1], p4[0], p4[1], p2[0], p2[1]);
  const d3 = d(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
  const d4 = d(p1[0], p1[1], p2[0], p2[1], p4[0], p4[1]);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** True if any two non-adjacent edges of the polygon cross each other. */
export function isSelfIntersecting(polygon: readonly Point[]): boolean {
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const a1 = polygon[i];
    const a2 = polygon[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // Adjacent edges share an endpoint by construction — that shared vertex isn't a crossing.
      if (j === i || j === (i + 1) % n || (j + 1) % n === i) continue;
      const b1 = polygon[j];
      const b2 = polygon[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

/**
 * Fills `coreMap` (row-major `dim`x`dim`, matching `mapX`/`mapY`'s layout) with 0 at every cell
 * whose center falls inside `polygon`, leaving other cells untouched. One scanline per row: the
 * intersections of that row's horizontal line with the polygon's edges are found once, then reused
 * for every cell in the row (an even-odd count against those intersections is cheaper than a fresh
 * `pointInPolygon` ray cast per cell).
 */
export function rasterizePolygon(
  coreMap: Float64Array,
  mapX: Float64Array,
  mapY: Float64Array,
  dim: number,
  polygon: readonly Point[],
): void {
  const n = polygon.length;
  const xAtY: number[] = [];
  for (let r = 0; r < dim; r++) {
    const rowStart = r * dim;
    const y = mapY[rowStart];
    xAtY.length = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      const crosses = yi > y !== yj > y;
      if (crosses) xAtY.push(xi + ((y - yi) / (yj - yi)) * (xj - xi));
    }
    if (xAtY.length === 0) continue;
    xAtY.sort((a, b) => a - b);

    for (let c = 0; c < dim; c++) {
      const x = mapX[rowStart + c];
      let crossingCount = 0;
      for (const xCross of xAtY) {
        if (x < xCross) crossingCount++;
      }
      if (crossingCount % 2 === 1) coreMap[rowStart + c] = 0;
    }
  }
}
