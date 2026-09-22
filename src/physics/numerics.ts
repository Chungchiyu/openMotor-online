/**
 * Small numerical helpers standing in for the scipy solvers (`newton`, `fsolve`) used by the
 * Python original. These aren't general-purpose replacements — each is shaped for how its single
 * caller in this codebase actually uses it.
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
