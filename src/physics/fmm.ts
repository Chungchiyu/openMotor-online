/**
 * Fast Marching Method distance transform — a faithful port of scikit-fmm's actual C++ core
 * (`base_marcher.cpp` / `distance_marcher.cpp`, MIT-licensed, from the `scikit-fmm` PyPI sdist),
 * not a from-scratch implementation written from the general textbook description of Sethian's
 * algorithm. An earlier version of this file *was* written that way, and while it got close on the
 * star grain reference fixture (see fmmGrain.ts), a direct cell-by-cell diff against skfmm on an
 * identical core map turned up a real, non-truncation gap concentrated exactly at caustics — the
 * ridges in the distance field where wavefronts from separate seeds (e.g. two adjacent star grain
 * points burning into each other) collide. Reading skfmm's actual source turned up four concrete
 * differences from what the textbook description (and the old version of this file) implies:
 *
 *  1. skfmm never checks causality (that a solved update T is >= every neighbor value it was built
 *     from) — it just uses the quadratic's root as-is, no matter what.
 *  2. Order degradation is coarse, not per-axis: solve using every available axis at order 2; if
 *     that quadratic has no real root, redo the *entire* update at order 1 using every available
 *     axis (a fresh, separate pass — not a downgrade of just the offending axis); if that also has
 *     no real root, use the order-1 parabola's vertex (`-b / 2a`). It never drops an axis.
 *  3. When a point freezes, skfmm also reaches two grid steps out (in the same direction) to
 *     re-update any narrow-band point that can now pick up a second-order neighbor, not just the
 *     point's direct neighbors.
 *  4. skfmm freezes every point currently tied for the smallest heap value as one batch *before*
 *     updating any of their neighbors, rather than processing the heap one point at a time. This
 *     matters most at symmetric caustics, where several cells reach the same distance in the same
 *     step — processing them one at a time lets whichever one is handled first leak its (now-frozen)
 *     value to its still-narrow tied siblings, which skfmm's simultaneous batch freeze prevents.
 *
 * All four are reproduced here. See fmm.test.ts, which checks this against skfmm.distance() output
 * directly (including a symmetric multi-seed case that exercises #4) rather than only end to end.
 */

const FAR = 0;
const NARROW = 1;
const FROZEN = 2;

class MinHeap {
  private dist: number[] = [];
  private idx: number[] = [];

  get size(): number {
    return this.dist.length;
  }

  push(distance: number, index: number): void {
    this.dist.push(distance);
    this.idx.push(index);
    let i = this.dist.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.dist[parent] <= this.dist[i]) break;
      this.swap(parent, i);
      i = parent;
    }
  }

  pop(): { distance: number; index: number } | undefined {
    if (this.dist.length === 0) return undefined;
    const topDist = this.dist[0];
    const topIdx = this.idx[0];
    const lastDist = this.dist.pop()!;
    const lastIdx = this.idx.pop()!;
    if (this.dist.length > 0) {
      this.dist[0] = lastDist;
      this.idx[0] = lastIdx;
      let i = 0;
      const n = this.dist.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < n && this.dist[l] < this.dist[smallest]) smallest = l;
        if (r < n && this.dist[r] < this.dist[smallest]) smallest = r;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return { distance: topDist, index: topIdx };
  }

  private swap(a: number, b: number): void {
    [this.dist[a], this.dist[b]] = [this.dist[b], this.dist[a]];
    [this.idx[a], this.idx[b]] = [this.idx[b], this.idx[a]];
  }
}

/**
 * Computes the fast-marching distance from the zero set of `coreMap` (cells equal to 0) to every
 * other cell within `inDomain`, on a `dim`x`dim` grid with isotropic cell spacing `h`. Cells outside
 * `inDomain` are excluded entirely (neither contribute to nor receive a distance) — skfmm's masked
 * array plays the same role. Always runs at skfmm's default order (2), matching the unadorned
 * `skfmm.distance(masked, dx=cellSize)` call in the Python original.
 */
export function fastMarchDistance(coreMap: Float64Array, inDomain: Uint8Array, dim: number, h: number): Float64Array {
  const n = dim * dim;
  const distance = new Float64Array(n).fill(Infinity);
  const status = new Uint8Array(n); // FAR by default
  const idx2 = 1 / (h * h);

  const heap = new MinHeap();
  const at = (r: number, c: number) => r * dim + c;

  // Mirrors skfmm's `_getN`: the neighbor one step from (r, c) along an axis, or null if that's out
  // of bounds or outside the domain (skfmm's Mask). Domain exclusion is unconditional here, standing
  // in for every call skfmm makes with `flag=Mask`.
  const neighbor = (r: number, c: number, dr: number, dc: number): number | null => {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= dim || nc < 0 || nc >= dim) return null;
    const i = at(nr, nc);
    return inDomain[i] === 1 ? i : null;
  };

  const AXES: [number, number][] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  // Paired as (axis, direction) for the two grid axes, matching skfmm's `for dim in 0..ndim: for j
  // in [-1, 1]`.
  const AXIS_DIRS: [number, number][][] = [
    [
      [-1, 0],
      [1, 0],
    ],
    [
      [0, -1],
      [0, 1],
    ],
  ];

  // Seed cells: exactly on the interface, distance 0. (skfmm's distanceMarcher::initalizeFrozen also
  // interpolates a sub-cell boundary when phi changes sign between neighbors — irrelevant here since
  // coreMap only ever takes the values 0 or 1, never crossing zero between adjacent cells.)
  for (let i = 0; i < n; i++) {
    if (inDomain[i] === 1 && coreMap[i] === 0) {
      distance[i] = 0;
      status[i] = FROZEN;
    }
  }

  const solveQuadratic = (a: number, b: number, cRaw: number): number | null => {
    const c = cRaw - 1;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    // skfmm always takes the "+" root for phi > 0 (every cell we ever solve for here — seed cells
    // are handled separately above and never reach this function).
    return (-b + Math.sqrt(disc)) / (2 * a);
  };

  const updateOrderOne = (r: number, c: number): number => {
    let a = 0;
    let b = 0;
    let cc = 0;
    for (const dirs of AXIS_DIRS) {
      let value = Infinity;
      for (const [dr, dc] of dirs) {
        const ni = neighbor(r, c, dr, dc);
        if (ni !== null && status[ni] === FROZEN && distance[ni] < value) value = distance[ni];
      }
      if (value < Infinity) {
        a += idx2;
        b -= idx2 * 2 * value;
        cc += idx2 * value * value;
      }
    }
    const t = solveQuadratic(a, b, cc);
    // skfmm's fallback when the quadratic has no real root: the parabola's vertex.
    return t === null ? -b / (2 * a) : t;
  };

  const updateOrderTwo = (r: number, c: number): number => {
    let a = 0;
    let b = 0;
    let cc = 0;
    for (const dirs of AXIS_DIRS) {
      let value1 = Infinity;
      let value2 = Infinity;
      for (const [dr, dc] of dirs) {
        const ni = neighbor(r, c, dr, dc);
        if (ni !== null && status[ni] === FROZEN && distance[ni] < value1) {
          value1 = distance[ni];
          const ni2 = neighbor(r, c, dr * 2, dc * 2);
          if (ni2 !== null && status[ni2] === FROZEN && distance[ni2] <= value1) value2 = distance[ni2];
        }
      }
      if (value2 < Infinity) {
        const tp = (4 * value1 - value2) / 3;
        a += idx2 * 2.25;
        b -= idx2 * 4.5 * tp;
        cc += idx2 * 2.25 * tp * tp;
      } else if (value1 < Infinity) {
        a += idx2;
        b -= idx2 * 2 * value1;
        cc += idx2 * value1 * value1;
      }
    }
    const t = solveQuadratic(a, b, cc);
    // skfmm's fallback when the order-2 quadratic has no real root: a completely fresh order-1
    // update (every axis re-scanned at order 1), not a per-axis downgrade.
    return t === null ? updateOrderOne(r, c) : t;
  };

  // Narrow band seed: every FAR cell bordering a FROZEN one gets one initial order-2 update.
  for (let r = 0; r < dim; r++) {
    for (let c = 0; c < dim; c++) {
      const i = at(r, c);
      if (inDomain[i] !== 1 || status[i] !== FAR) continue;
      let bordersFrozen = false;
      for (const [dr, dc] of AXES) {
        const ni = neighbor(r, c, dr, dc);
        if (ni !== null && status[ni] === FROZEN) {
          bordersFrozen = true;
          break;
        }
      }
      if (!bordersFrozen) continue;
      const d = updateOrderTwo(r, c);
      distance[i] = d;
      status[i] = NARROW;
      heap.push(d, i);
    }
  }

  // Main loop. `pending` carries over a popped-but-not-yet-consumed entry from one tie batch to the
  // next, since the heap has no decrease-key: a cell's distance can be improved (and re-pushed)
  // before its earlier, stale entry is ever popped, but min-heap ordering guarantees the freshest
  // (smallest) entry for any cell always pops before its stale duplicates, so skipping entries for
  // already-FROZEN cells is all the staleness check that's needed.
  let pending: { distance: number; index: number } | undefined;
  const popValid = (): { distance: number; index: number } | undefined => {
    for (;;) {
      const top = heap.pop();
      if (!top) return undefined;
      if (status[top.index] === FROZEN) continue;
      return top;
    }
  };

  for (;;) {
    const first = pending ?? popValid();
    pending = undefined;
    if (!first) break;

    const value = first.distance;
    const toFreeze = [first.index];
    status[first.index] = FROZEN;
    for (;;) {
      const next = popValid();
      if (!next) break;
      if (next.distance === value) {
        status[next.index] = FROZEN;
        toFreeze.push(next.index);
      } else {
        pending = next;
        break;
      }
    }

    for (const addr of toFreeze) {
      const r = Math.floor(addr / dim);
      const c = addr % dim;
      for (const [dr, dc] of AXES) {
        // The immediate neighbor in this direction, any status (mirrors skfmm's Mask-only lookup).
        const ni = neighbor(r, c, dr, dc);
        if (ni === null) continue;
        if (status[ni] !== FROZEN) {
          // Not frozen yet: a normal direct update (Narrow gets refreshed, Far gets newly seeded).
          const d = updateOrderTwo(r + dr, c + dc);
          if (d !== 0) {
            distance[ni] = d;
            if (status[ni] === FAR) status[ni] = NARROW;
            heap.push(d, ni);
          }
        } else {
          // Already frozen: jump over it to re-update a narrow-band point two steps out, which may
          // now have a fresh order-2 neighbor available (this frozen cell plus the one that just
          // froze at `addr`).
          const jumpR = r + 2 * dr;
          const jumpC = c + 2 * dc;
          const jumpI = neighbor(r, c, 2 * dr, 2 * dc);
          if (jumpI !== null && status[jumpI] === NARROW) {
            const d2 = updateOrderTwo(jumpR, jumpC);
            if (d2 !== 0) {
              distance[jumpI] = d2;
              heap.push(d2, jumpI);
            }
          }
        }
      }
    }
  }

  return distance;
}
