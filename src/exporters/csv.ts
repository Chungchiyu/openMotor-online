import type { SimulationResult } from '../physics/simResult';

/** Thin wrapper over SimulationResult.getCSV — kept as its own module to match eng.ts/burnsim.ts
 * so App.tsx's export menu can treat every format the same way. */
export function buildCsvFile(result: SimulationResult, unitFor: (canonical: string) => string): string {
  return result.getCSV(unitFor);
}
