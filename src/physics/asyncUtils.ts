/**
 * Hands control back to the browser's event loop — long enough for a paint + input processing
 * pass, which is what lets a just-rendered progress dialog actually appear and a Cancel click
 * actually register. Shared by `motor.ts`'s timestep loop and `fmmGrain.ts`'s regression-table
 * build, the two places slow enough to need chunking with real progress reporting.
 */
export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
