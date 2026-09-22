/**
 * Marching squares contour extraction. Stands in for the project's Cython `mathlib.find_perimeter`
 * (itself a fused variant of the standard algorithm behind `skimage.measure.find_contours`) — this
 * is the general-purpose marching squares algorithm, not something openMotor-specific.
 *
 * Used two ways here:
 *  - `contourPerimeter`: just the total length of the level-set contour, for the burning-perimeter
 *    lookup table built once per grain in fmmGrain.ts.
 *  - `contourSegments`: the actual line segments, for drawing regression contours over the grain
 *    cross-section preview. Segments aren't stitched into ordered polylines (the Python version's
 *    `_assemble_contours` does this) since a canvas stroke of disconnected segments looks the same
 *    as a stitched polyline and skipping the bookkeeping is simpler.
 */

export interface Segment {
  a: [number, number];
  b: [number, number];
}

function edgePoint(
  r0: number,
  c0: number,
  r1: number,
  c1: number,
  v0: number,
  v1: number,
  level: number,
): [number, number] {
  const t = (level - v0) / (v1 - v0);
  return [r0 + (r1 - r0) * t, c0 + (c1 - c0) * t];
}

/**
 * Walks every cell of a `dim`x`dim` grid (row-major) and returns the marching-squares contour
 * segments crossing `level`, plus their total length.
 */
export function marchContour(
  grid: Float64Array,
  dim: number,
  level: number,
  valid?: Uint8Array,
): { segments: Segment[]; perimeter: number } {
  const segments: Segment[] = [];
  let perimeter = 0;

  const at = (r: number, c: number) => grid[r * dim + c];
  const isValid = (r: number, c: number) => !valid || valid[r * dim + c] === 1;

  for (let r = 0; r < dim - 1; r++) {
    for (let c = 0; c < dim - 1; c++) {
      // Skip any cell that touches the excluded domain (e.g. the square map's corners outside the
      // grain's circular OD) — those cells hold Infinity/placeholder distance values that would
      // otherwise interpolate into NaN or a spurious contour running along the domain boundary.
      if (!isValid(r, c) || !isValid(r, c + 1) || !isValid(r + 1, c) || !isValid(r + 1, c + 1)) continue;

      const a = at(r, c); // top-left
      const b = at(r, c + 1); // top-right
      const cc = at(r + 1, c + 1); // bottom-right
      const d = at(r + 1, c); // bottom-left

      // Strict `>` (not `>=`) matters at level 0: the seed cells sit at exactly distance 0, so
      // using `>=` would classify them the same as their distance-0-or-more neighbors and the
      // level-0 contour (the grain's initial core outline) would vanish entirely.
      const aAbove = a > level;
      const bAbove = b > level;
      const cAbove = cc > level;
      const dAbove = d > level;
      const code = (aAbove ? 8 : 0) | (bAbove ? 4 : 0) | (cAbove ? 2 : 0) | (dAbove ? 1 : 0);
      if (code === 0 || code === 15) continue;

      const top = () => edgePoint(r, c, r, c + 1, a, b, level);
      const right = () => edgePoint(r, c + 1, r + 1, c + 1, b, cc, level);
      const bottom = () => edgePoint(r + 1, c, r + 1, c + 1, d, cc, level);
      const left = () => edgePoint(r, c, r + 1, c, a, d, level);

      const addSeg = (p1: [number, number], p2: [number, number]) => {
        segments.push({ a: p1, b: p2 });
        perimeter += Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
      };

      switch (code) {
        case 1:
        case 14:
          addSeg(left(), bottom());
          break;
        case 2:
        case 13:
          addSeg(bottom(), right());
          break;
        case 3:
        case 12:
          addSeg(left(), right());
          break;
        case 4:
        case 11:
          addSeg(top(), right());
          break;
        case 6:
        case 9:
          addSeg(top(), bottom());
          break;
        case 7:
        case 8:
          addSeg(top(), left());
          break;
        case 5: {
          const center = (a + b + cc + d) / 4;
          if (center >= level) {
            addSeg(top(), right());
            addSeg(left(), bottom());
          } else {
            addSeg(top(), left());
            addSeg(bottom(), right());
          }
          break;
        }
        case 10: {
          const center = (a + b + cc + d) / 4;
          if (center >= level) {
            addSeg(top(), left());
            addSeg(bottom(), right());
          } else {
            addSeg(top(), right());
            addSeg(left(), bottom());
          }
          break;
        }
        default:
          break;
      }
    }
  }

  return { segments, perimeter };
}

export function contourPerimeter(grid: Float64Array, dim: number, level: number, valid?: Uint8Array): number {
  return marchContour(grid, dim, level, valid).perimeter;
}
