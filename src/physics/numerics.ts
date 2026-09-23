/**
 * Small numerical helpers standing in for the scipy solvers (`newton`, `fsolve`, `savgol_filter`)
 * used by the Python original. These aren't general-purpose replacements — each is shaped for how
 * its single caller in this codebase actually uses it.
 */

/**
 * Newton-Raphson root find given a function and its analytic derivative. Mirrors
 * `scipy.optimize.newton(func, fprime=..., x0=...)` for the single scalar-argument case used by
 * `calcMachNumber`.
 */
export function newtonRaphson(
  func: (x: number) => number,
  fprime: (x: number) => number,
  x0: number,
  maxIter = 50,
  tol = 1e-10,
): number {
  let x = x0;
  for (let i = 0; i < maxIter; i++) {
    const fx = func(x);
    const fpx = fprime(x);
    if (fpx === 0) break;
    const next = x - fx / fpx;
    if (Math.abs(next - x) < tol) return next;
    x = next;
  }
  return x;
}

/**
 * Finds the smallest root of `f(x) - target` in `[lo, hi]`, assuming `f` rises from below target
 * to above it as `x` increases from `lo` (i.e. it finds the first crossing scanning upward, which
 * is what `scipy.optimize.fsolve` converges to from a low starting guess on the functions this is
 * used for). Falls back to returning `lo` if no crossing is found in range.
 */
export function findFirstRisingRoot(
  f: (x: number) => number,
  target: number,
  lo: number,
  hi: number,
  scanSteps = 500,
): number {
  const step = (hi - lo) / scanSteps;
  let prevX = lo;
  let prevVal = f(prevX) - target;
  for (let i = 1; i <= scanSteps; i++) {
    const x = lo + step * i;
    const val = f(x) - target;
    if ((prevVal <= 0 && val >= 0) || (prevVal >= 0 && val <= 0)) {
      // Bisect within [prevX, x] for precision
      let a = prevX;
      let b = x;
      let fa = prevVal;
      for (let iter = 0; iter < 60; iter++) {
        const mid = (a + b) / 2;
        const fm = f(mid) - target;
        if (fa === 0 || (b - a) / 2 < 1e-14) return mid;
        if ((fa < 0 && fm < 0) || (fa > 0 && fm > 0)) {
          a = mid;
          fa = fm;
        } else {
          b = mid;
        }
      }
      return (a + b) / 2;
    }
    prevX = x;
    prevVal = val;
  }
  return lo;
}

/**
 * Least-squares fit of a degree-`order` polynomial p(t) = c[0] + c[1]*t + ... + c[order]*t^order to
 * the points (ts[i], vs[i]), solved via the normal equations (Vandermonde^T Vandermonde). Callers
 * center `ts` near 0 so the Gram matrix stays well conditioned in double precision at the degree
 * this is used with (5).
 */
function polyfit(ts: number[], vs: number[], order: number): number[] {
  const m = order + 1;
  const gram: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
  const rhs: number[] = new Array(m).fill(0);
  for (let k = 0; k < ts.length; k++) {
    const powers = new Array(m);
    let p = 1;
    for (let j = 0; j < m; j++) {
      powers[j] = p;
      p *= ts[k];
    }
    for (let i = 0; i < m; i++) {
      rhs[i] += powers[i] * vs[k];
      for (let j = 0; j < m; j++) gram[i][j] += powers[i] * powers[j];
    }
  }

  // Gaussian elimination with partial pivoting on the small (order+1)x(order+1) system.
  for (let col = 0; col < m; col++) {
    let pivot = col;
    for (let row = col + 1; row < m; row++) {
      if (Math.abs(gram[row][col]) > Math.abs(gram[pivot][col])) pivot = row;
    }
    [gram[col], gram[pivot]] = [gram[pivot], gram[col]];
    [rhs[col], rhs[pivot]] = [rhs[pivot], rhs[col]];
    for (let row = col + 1; row < m; row++) {
      const factor = gram[row][col] / gram[col][col];
      for (let j = col; j < m; j++) gram[row][j] -= factor * gram[col][j];
      rhs[row] -= factor * rhs[col];
    }
  }
  const coeffs = new Array(m).fill(0);
  for (let row = m - 1; row >= 0; row--) {
    let sum = rhs[row];
    for (let j = row + 1; j < m; j++) sum -= gram[row][j] * coeffs[j];
    coeffs[row] = sum / gram[row][row];
  }
  return coeffs;
}

function polyval(coeffs: number[], t: number): number {
  let result = 0;
  let p = 1;
  for (let i = 0; i < coeffs.length; i++) {
    result += coeffs[i] * p;
    p *= t;
  }
  return result;
}

/**
 * Savitzky-Golay smoothing filter. Mirrors `scipy.signal.savgol_filter(x, windowLength, polyorder)`
 * (the `mode='interp'` default, `deriv=0`): every point is replaced by the value, at its own
 * position, of a degree-`polyorder` least-squares polynomial fit to the `windowLength` points
 * centered on it; points within half a window of either edge instead use the polynomial fit to the
 * boundary window (there's no symmetric neighborhood to center on), evaluated at their own position
 * within that window — same two-piece scheme scipy uses internally (a fixed centered convolution
 * kernel for the interior, `_fit_edge`'s per-edge polyfit for the boundary), just computed directly
 * per point instead of precomputing a convolution kernel, since this only ever runs once per grain
 * on tables with a few hundred to ~1000 points (see fmmGrain.ts).
 *
 * Used to reproduce the smoothing the Python original applies to a grain's face-area-vs-regression
 * table before interpolating it — skipping it left the port's face area (and everything derived
 * from it: volume, port area, mass flux) reading slightly different from Python at every timestep.
 *
 * `windowLength` must be odd, matching scipy's own requirement for `mode='interp'`. Arrays shorter
 * than `windowLength` are returned unchanged (scipy raises in this case, but every table this is
 * actually used on has hundreds of points — see fmmGrain.ts).
 */
export function savgolFilter(x: Float64Array, windowLength: number, polyorder: number): Float64Array {
  if (windowLength % 2 === 0) throw new Error('savgolFilter: windowLength must be odd');
  const n = x.length;
  if (n < windowLength) return x.slice();

  const half = (windowLength - 1) / 2;
  const y = new Float64Array(n);

  // Fits the `windowLength` points starting at `start` (using coordinates centered on the window,
  // ts = -half..half, for conditioning) and evaluates that fit at the point `atRel` slots from
  // `start`, expressed in the same centered coordinates as `atRel - half`.
  const fitAndEval = (start: number, atRel: number): number => {
    const ts: number[] = new Array(windowLength);
    const vs: number[] = new Array(windowLength);
    for (let k = 0; k < windowLength; k++) {
      ts[k] = k - half;
      vs[k] = x[start + k];
    }
    const coeffs = polyfit(ts, vs, polyorder);
    return polyval(coeffs, atRel - half);
  };

  for (let i = half; i < n - half; i++) y[i] = fitAndEval(i - half, half);
  for (let i = 0; i < half; i++) y[i] = fitAndEval(0, i);
  for (let i = n - half; i < n; i++) y[i] = fitAndEval(n - windowLength, i - (n - windowLength));

  return y;
}
