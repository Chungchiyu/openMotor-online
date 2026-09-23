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
 *
 * `restrictInterior` reproduces a quirk of the Python original's perimeter-only fast path
 * (`mathlib._get_perimeter`, called with `including_contours=False`): it skips the outer 3 pixels
 * of the array *and* any square whose center is within roughly 3 pixels of the grain's outer wall
 * (measured from the array's center, i.e. the circular OD, not the square array's corners). That
 * exclusion only applies when perimeter is wanted without the actual contour geometry — the
 * contour-returning path used for the regression preview does not apply it, so it must stay off by
 * default here too (`contourPerimeter` is the only caller that turns it on). Skipping it entirely
 * left our perimeter table overestimating the burning perimeter by double digits in the last few
 * percent of regression, right where a full or near-full sliver of remaining propellant sits close
 * against the outer wall (see fmmGrain.ts's reference tests for the effect on burn time).
 */
export function marchContour(
  grid: Float64Array,
  dim: number,
  level: number,
  valid?: Uint8Array,
  options?: { restrictInterior?: boolean; collectSegments?: boolean },
): { segments: Segment[]; perimeter: number } {
  const segments: Segment[] = [];
  let perimeter = 0;
  const restrictInterior = options?.restrictInterior ?? false;
  const collectSegments = options?.collectSegments ?? true;
  const gridCenter = dim / 2;
  const radiusCutoffSq = (gridCenter - 3) ** 2;

  const at = (r: number, c: number) => grid[r * dim + c];
  const isValid = (r: number, c: number) => !valid || valid[r * dim + c] === 1;

  const rLo = restrictInterior ? 3 : 0;
  const rHi = restrictInterior ? dim - 5 : dim - 2;
  const cLo = restrictInterior ? 3 : 0;
  const cHi = restrictInterior ? dim - 5 : dim - 2;

  for (let r = rLo; r <= rHi; r++) {
    const dr = r + 0.5 - gridCenter;
    const drSq = dr * dr;
    for (let c = cLo; c <= cHi; c++) {
      if (restrictInterior) {
        const dc = c + 0.5 - gridCenter;
        if (drSq + dc * dc > radiusCutoffSq) continue;
      }
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
        if (collectSegments) segments.push({ a: p1, b: p2 });
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
  return marchContour(grid, dim, level, valid, { restrictInterior: true, collectSegments: false }).perimeter;
}

/**
 * Chains `marchContour`'s disconnected per-cell segments into continuous polylines, for callers that
 * draw them (the grain preview canvas). Two segments from neighboring cells that trace the same edge
 * of the level set always compute that shared endpoint via the exact same `edgePoint(...)` call (same
 * corner coordinates, same corner values, same level), so endpoints that belong together are bit-for-
 * bit identical — matching them by exact value (not a floating-point tolerance) is reliable.
 *
 * Not doing this (drawing every segment as its own `moveTo`+`lineTo`, as the canvas previously did)
 * gives every segment independent butt caps instead of letting the renderer join consecutive pieces
 * of what is really one continuous edge — on some browsers'/GPUs' canvas rasterizers this can show up
 * as visible seams or a jittery/zigzag look along an otherwise-smooth curve, worst on sharp features
 * (star points, a moon burner's crescent) where many short segments meet at varied angles.
 */
export function assemblePolylines(segments: Segment[]): [number, number][][] {
  const key = (p: [number, number]) => `${p[0]},${p[1]}`;

  // For each endpoint value, which (segment index, which end) touch it — a proper edge list would
  // need at most two per key for a simple (non-self-crossing) contour, but ties/duplicate points are
  // handled fine by just consuming whichever unused occurrence comes first.
  const byEndpoint = new Map<string, { seg: number; end: 0 | 1 }[]>();
  const addEndpoint = (k: string, entry: { seg: number; end: 0 | 1 }) => {
    const list = byEndpoint.get(k);
    if (list) list.push(entry);
    else byEndpoint.set(k, [entry]);
  };
  segments.forEach((seg, i) => {
    addEndpoint(key(seg.a), { seg: i, end: 0 });
    addEndpoint(key(seg.b), { seg: i, end: 1 });
  });

  const used = new Uint8Array(segments.length);
  // Removes one specific (seg, end) occurrence so it can't be picked again as a continuation.
  const consume = (k: string, seg: number, end: 0 | 1) => {
    const list = byEndpoint.get(k);
    if (!list) return;
    const i = list.findIndex((e) => e.seg === seg && e.end === end);
    if (i >= 0) list.splice(i, 1);
  };
  // The other endpoint of the same segment, to keep walking from once one end is consumed.
  const otherEnd = (seg: number, end: 0 | 1): [number, number] => (end === 0 ? segments[seg].b : segments[seg].a);

  const polylines: [number, number][][] = [];
  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    consume(key(segments[i].a), i, 0);
    consume(key(segments[i].b), i, 1);
    const line: [number, number][] = [segments[i].a, segments[i].b];

    // Extend forward from the tail, then backward from the head, following shared endpoints.
    for (const [growTail, point] of [
      [true, line[line.length - 1]],
      [false, line[0]],
    ] as const) {
      let current = point;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const candidates = byEndpoint.get(key(current));
        // Only auto-continue when exactly one unused segment touches this point. At a genuine branch
        // point (3+ segments sharing a coordinate — happens at level 0 exactly, where many seed-cell
        // corners tie at distance 0) there's no way to know which candidate continues *this* edge
        // without guessing, and guessing can bridge two unrelated parts of the contour into a bogus
        // connecting line. Stopping here leaves the other branches to be picked up as their own
        // chains by the outer loop below (each one strand of the tie, not fused together wrong).
        if (!candidates || candidates.length !== 1) break;
        const next = candidates[0];
        used[next.seg] = 1;
        consume(key(segments[next.seg].a), next.seg, 0);
        consume(key(segments[next.seg].b), next.seg, 1);
        current = otherEnd(next.seg, next.end);
        if (growTail) line.push(current);
        else line.unshift(current);
      }
    }
    polylines.push(line);
  }
  return polylines;
}

/**
 * Builds a whole perimeter-vs-level table in a single pass over the grid, instead of calling
 * `contourPerimeter` once per level (which re-scans the whole `dim`x`dim` grid for every level —
 * O(levels.length * dim^2) total, and the dominant cost of FMM grain setup at real mapDim values).
 *
 * A cell can only cross a given level when that level falls strictly between the min and max of its
 * four corner values — exactly the condition under which `code` above is neither 0 nor 15. Since the
 * regression map is an eikonal distance field (|grad| ~= 1 by construction), that range only spans a
 * handful of consecutive `levels` entries per cell, not the whole table. So scanning cell-first and,
 * for each cell, only evaluating the few levels it can actually cross — using the exact same
 * `code`/`edgePoint` logic as `marchContour` above, not an approximation of it — turns the total cost
 * into O(dim^2), the same order as the face-area histogram and the fast-marching pass itself.
 *
 * Row-major cell traversal is preserved (same order `marchContour` would visit cells in for any given
 * level), so each level's accumulated sum lands in the exact same floating-point addition order as
 * calling `contourPerimeter` once per level would produce — this is a pure algorithmic speedup, not
 * a lower-precision substitute (see `contours.perimeterTable.test.ts`, which checks this directly
 * against the brute-force per-level loop).
 *
 * Accumulates into `out` (same length as `levels`), which the caller must zero-initialize itself —
 * this function only adds to it, so a caller can build the table across several calls restricted to
 * different `[rowLo, rowHi]` row ranges (see fmmGrain.ts's `simulationSetupChunked`, which chunks
 * this way so it can still yield/cancel mid-build on a very large grid).
 */
export function buildPerimeterTable(
  grid: Float64Array,
  dim: number,
  levels: Float64Array,
  valid: Uint8Array | undefined,
  out: Float64Array,
  rowLo: number,
  rowHi: number,
): void {
  const numLevels = levels.length;
  if (numLevels === 0) return;
  const dx = numLevels > 1 ? levels[1] - levels[0] : 0;
  const gridCenter = dim / 2;
  const radiusCutoffSq = (gridCenter - 3) ** 2;

  const at = (r: number, c: number) => grid[r * dim + c];
  const isValid = (r: number, c: number) => !valid || valid[r * dim + c] === 1;

  // Same bounds as `contourPerimeter`'s `restrictInterior: true` (see the comment on `marchContour`).
  const rLo = Math.max(3, rowLo);
  const rHi = Math.min(dim - 5, rowHi);
  const cLo = 3;
  const cHi = dim - 5;

  for (let r = rLo; r <= rHi; r++) {
    const dr = r + 0.5 - gridCenter;
    const drSq = dr * dr;
    for (let c = cLo; c <= cHi; c++) {
      const dc = c + 0.5 - gridCenter;
      if (drSq + dc * dc > radiusCutoffSq) continue;
      if (!isValid(r, c) || !isValid(r, c + 1) || !isValid(r + 1, c) || !isValid(r + 1, c + 1)) continue;

      const a = at(r, c);
      const b = at(r, c + 1);
      const cc = at(r + 1, c + 1);
      const d = at(r + 1, c);

      const minV = Math.min(a, b, cc, d);
      const maxV = Math.max(a, b, cc, d);
      if (minV >= maxV) continue; // Flat cell: never crosses any level (code is always 0 or 15).

      // Candidate level indices are those with minV <= levels[i] < maxV. Widen by a few levels on
      // each side as a floating-point safety margin — the exact per-level `code` check inside the
      // loop below discards anything outside the true range at negligible extra cost, so this only
      // needs to be wide enough to never *miss* a real crossing, not tight.
      let iLo = 0;
      let iHi = numLevels - 1;
      if (numLevels > 1) {
        iLo = Math.max(0, Math.floor(minV / dx) - 4);
        iHi = Math.min(numLevels - 1, Math.ceil(maxV / dx) + 4);
      }

      for (let i = iLo; i <= iHi; i++) {
        const level = levels[i];
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
          out[i] += Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
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
  }
}
