/**
 * Fast Marching Method distance transform.
 *
 * This is a from-scratch, standard first-order implementation of the eikonal-equation solver
 * (Sethian's Fast Marching Method) — a well-known general algorithm, not something specific to
 * openMotor. It stands in for `skfmm.distance()`, which the Python original uses to compute how
 * far every point in a grain's cross-section is from the initial core boundary.
 *
 * Given a 2D grid where cells with value 0 are the "seed" (the core boundary — distance zero) and
 * cells with value 1 are unburned propellant, this returns the distance from every propellant cell
 * to the nearest seed cell, restricted to an active domain mask (used here to exclude the corners
 * outside the grain's circular outer wall — a real burn front never needs to route around that
 * area, so leaving it out of the domain doesn't change the result inside the circle, it just skips
 * wasted work).
 *
 * Numerically this uses a first-order upwind update, while `skfmm` uses second order where
 * possible. Expect distances to differ from the Python reference by a small amount (a fraction of
 * a grid cell) — for the FMM-based grains, tests allow a wider tolerance than for the analytic
 * (BATES) grains for this reason. See src/physics/__tests__ for the specifics.
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

  const tryUpdate = (r: number, c: number): void => {
    const i = at(r, c);
    if (status[i] === KNOWN) return;

    let hMin = Infinity;
    for (const [nr, nc] of [
      [r, c - 1],
      [r, c + 1],
    ] as [number, number][]) {
      if (validCell(nr, nc) && status[at(nr, nc)] === KNOWN) hMin = Math.min(hMin, distance[at(nr, nc)]);
    }
    let vMin = Infinity;
    for (const [nr, nc] of [
      [r - 1, c],
      [r + 1, c],
    ] as [number, number][]) {
      if (validCell(nr, nc) && status[at(nr, nc)] === KNOWN) vMin = Math.min(vMin, distance[at(nr, nc)]);
    }

    let newDist: number;
    if (hMin < Infinity && vMin < Infinity) {
      if (Math.abs(hMin - vMin) >= h) {
        newDist = Math.min(hMin, vMin) + h;
      } else {
        newDist = (hMin + vMin + Math.sqrt(2 * h * h - (hMin - vMin) ** 2)) / 2;
      }
    } else if (hMin < Infinity) {
      newDist = hMin + h;
    } else if (vMin < Infinity) {
      newDist = vMin + h;
    } else {
      return;
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
