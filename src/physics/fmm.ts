/**
 * Fast Marching Method distance transform.
 *
 * This is a from-scratch implementation of the eikonal-equation solver (Sethian's Fast Marching
 * Method) — a well-known general algorithm, not something specific to openMotor. It stands in for
 * `skfmm.distance()`, which the Python original uses to compute how far every point in a grain's
 * cross-section is from the initial core boundary.
 *
 * Given a 2D grid where cells with value 0 are the "seed" (the core boundary — distance zero) and
 * cells with value 1 are unburned propellant, this returns the distance from every propellant cell
 * to the nearest seed cell, restricted to an active domain mask (used here to exclude the corners
 * outside the grain's circular outer wall — a real burn front never needs to route around that
 * area, so leaving it out of the domain doesn't change the result inside the circle, it just skips
 * wasted work).
 *
 * Like `skfmm`, this prefers a second-order one-sided update along each axis (falling back to
 * first-order, then to dropping an axis entirely, wherever a consistent second neighbor isn't
 * available or the resulting quadratic has no valid root) — see `probeAxis`/`solve` below. An
 * earlier, purely first-order version of this file had a small but systematically growing distance
 * bias relative to the Python reference (traced by diffing raw regression-map output against
 * `skfmm.distance()` on an identical core map): at a coarse 101x101 test grid it ran from 0% right
 * at the seed up to several percent farther out. This second-order scheme cuts that bias by roughly
 * half at the same resolution, and — because truncation error for a scheme like this shrinks with
 * grid spacing — down to a small fraction of a percent at the ~750x750 resolution the app actually
 * simulates at. Getting the star/moon-burner grains' end-to-end burn time/ISP/average force under
 * ~0.03% of the Python reference (see fmmGrain.ts's reference tests) also needed two more fixes on
 * top of this one: the burning-perimeter/face-area lookup tables built from this distance field
 * needed to sample at Python's per-pixel resolution instead of a fixed low resolution, and the
 * perimeter calculation needed to reproduce a Python quirk that excludes contour cells within ~3
 * pixels of the outer wall (see fmmGrain.ts and contours.ts).
 */

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

const KNOWN = 2;
const TRIAL = 1;
// Cells default to 0 (FAR) via the Uint8Array's zero-initialization; no explicit constant needed.

/**
 * Computes the fast-marching distance from the zero set of `coreMap` (cells equal to 0) to every
 * other cell within `inDomain`, on a `dim`x`dim` grid with isotropic cell spacing `h`.
 * Cells outside `inDomain` are excluded entirely (neither contribute to nor receive a distance).
 */
export function fastMarchDistance(coreMap: Float64Array, inDomain: Uint8Array, dim: number, h: number): Float64Array {
  const n = dim * dim;
  const distance = new Float64Array(n).fill(Infinity);
  const status = new Uint8Array(n); // FAR by default

  const heap = new MinHeap();

  const at = (r: number, c: number) => r * dim + c;
  const validCell = (r: number, c: number) => r >= 0 && r < dim && c >= 0 && c < dim && inDomain[at(r, c)] === 1;

  // Seed cells: exactly on the interface, distance 0.
  for (let r = 0; r < dim; r++) {
    for (let c = 0; c < dim; c++) {
      const i = at(r, c);
      if (inDomain[i] === 1 && coreMap[i] === 0) {
        distance[i] = 0;
        status[i] = KNOWN;
      }
    }
  }

  const neighborsOf = (r: number, c: number): [number, number][] => [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ];

  // One axis's contribution to the local eikonal update: the nearest KNOWN neighbor along the axis
  // (whichever of the two opposite directions is smaller), plus optionally the next KNOWN neighbor
  // further out in that same direction (u2), which — when it's <= u1, preserving monotonicity along
  // the axis — lets the update use a second-order one-sided difference instead of first-order. This
  // mirrors skfmm's scheme (it defaults to second order, falling back to first order wherever a
  // consistent second neighbor isn't available), which is why the previous purely first-order port
  // had a growing distance bias relative to the Python reference (see fmmGrain.ts/contours.ts
  // callers and the reference tests for the effect this had on downstream burn geometry).
  const probeAxis = (r: number, c: number, dr: number, dc: number): { u1: number; u2: number | null } | null => {
    const negR = r - dr;
    const negC = c - dc;
    const posR = r + dr;
    const posC = c + dc;
    const negKnown = validCell(negR, negC) && status[at(negR, negC)] === KNOWN;
    const posKnown = validCell(posR, posC) && status[at(posR, posC)] === KNOWN;

    let side = 0;
    let u1 = Infinity;
    if (negKnown) {
      u1 = distance[at(negR, negC)];
      side = -1;
    }
    if (posKnown) {
      const v = distance[at(posR, posC)];
      if (v < u1) {
        u1 = v;
        side = 1;
      }
    }
    if (side === 0) return null;

    const farR = r + 2 * side * dr;
    const farC = c + 2 * side * dc;
    let u2: number | null = null;
    if (validCell(farR, farC) && status[at(farR, farC)] === KNOWN) {
      const v2 = distance[at(farR, farC)];
      if (v2 <= u1) u2 = v2;
    }
    return { u1, u2 };
  };

  // Solves sum_i (D_i)^2 = 1/h^2 for the eikonal update, where each axis's D_i is either the
  // first-order one-sided difference (T - u1)/h or, at order 2, (3T - 4*u1 + u2)/(2h). Returns null
  // if the quadratic has no real root, or if the root would violate causality (T must be >= every
  // u1 it was built from) — the caller responds by degrading order/dropping axes and retrying, same
  // as skfmm does.
  const solve = (axes: { u1: number; u2: number | null }[], orders: number[]): number | null => {
    let A = 0;
    let B = 0;
    let C = 0;
    for (let k = 0; k < axes.length; k++) {
      const { u1, u2 } = axes[k];
      if (orders[k] === 2 && u2 !== null) {
        const k4 = 4 * u1 - u2;
        A += 9 / (4 * h * h);
        B += (-3 * k4) / (2 * h * h);
        C += (k4 * k4) / (4 * h * h);
      } else {
        A += 1 / (h * h);
        B += (-2 * u1) / (h * h);
        C += (u1 * u1) / (h * h);
      }
    }
    const disc = B * B - 4 * A * (C - 1);
    if (disc < 0) return null;
    const T = (-B + Math.sqrt(disc)) / (2 * A);
    for (const { u1 } of axes) {
      if (T < u1 - 1e-12) return null;
    }
    return T;
  };

  const tryUpdate = (r: number, c: number): void => {
    const i = at(r, c);
    if (status[i] === KNOWN) return;

    const axes = [probeAxis(r, c, 0, 1), probeAxis(r, c, 1, 0)].filter(
      (a): a is { u1: number; u2: number | null } => a !== null,
    );
    if (axes.length === 0) return;

    const orders = axes.map((a) => (a.u2 !== null ? 2 : 1));
    let newDist = solve(axes, orders);
    while (newDist === null) {
      const idx2 = orders.findIndex((o) => o === 2);
      if (idx2 !== -1) {
        orders[idx2] = 1;
      } else if (axes.length > 1) {
        let worst = 0;
        for (let k = 1; k < axes.length; k++) {
          if (axes[k].u1 > axes[worst].u1) worst = k;
        }
        axes.splice(worst, 1);
        orders.splice(worst, 1);
      } else {
        newDist = axes[0].u1 + h;
        break;
      }
      newDist = solve(axes, orders);
    }

    if (newDist < distance[i]) {
      distance[i] = newDist;
      status[i] = TRIAL;
      heap.push(newDist, i);
    }
  };

  // Seed the initial trial band from the neighbors of every seed cell.
  for (let r = 0; r < dim; r++) {
    for (let c = 0; c < dim; c++) {
      const i = at(r, c);
      if (status[i] === KNOWN) {
        for (const [nr, nc] of neighborsOf(r, c)) {
          if (validCell(nr, nc) && status[at(nr, nc)] !== KNOWN) tryUpdate(nr, nc);
        }
      }
    }
  }

  for (;;) {
    const top = heap.pop();
    if (!top) break;
    const { index } = top;
    if (status[index] === KNOWN) continue; // stale heap entry
    status[index] = KNOWN;
    const r = Math.floor(index / dim);
    const c = index % dim;
    for (const [nr, nc] of neighborsOf(r, c)) {
      if (validCell(nr, nc) && status[at(nr, nc)] !== KNOWN) tryUpdate(nr, nc);
    }
  }

  return distance;
}
