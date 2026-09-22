/**
 * `Math.max(...array)` / `Math.min(...array)` (spreading an array into function arguments) throws
 * `RangeError: Maximum call stack size exceeded` once the array is large enough — around 100k+
 * elements depending on the engine. A multi-second burn simulated at a small timestep can produce
 * per-channel arrays with that many entries, so anything walking a simulation channel must reduce
 * with a plain loop instead of spreading.
 */

export function arrayMax(arr: readonly number[]): number {
  let max = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i];
  }
  return max;
}

export function arrayMin(arr: readonly number[]): number {
  let min = Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < min) min = arr[i];
  }
  return min;
}
