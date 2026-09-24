/**
 * MOTOR-type `.ric` data ⇄ `MotorDesign`. Python's `Motor.getDict()`/`applyDict()`
 * (motorlib/motor.py) produce/consume exactly the shape `MotorDesign` already uses — same keys,
 * same nesting, same SI units (see types.ts's header comment) — so this is a structural
 * passthrough plus one real compatibility gap: Python's `Custom Grain` (DXF-imported polygon
 * geometry) has no TS equivalent. An imported file containing one has that grain skipped with an
 * error message, following the same "accumulate errors, don't crash" pattern as the BurnSim
 * importer (exporters/burnsim.ts) — the rest of the motor still loads.
 */
import type { GrainConfig, MotorDesign } from '../physics/types';

const KNOWN_GRAIN_TYPES = new Set<GrainConfig['type']>([
  'BATES',
  'Star Grain',
  'Moon Burner',
  'D Grain',
  'X Core',
  'C Grain',
  'Finocyl',
  'Rod and Tube',
  'End Burner',
  'Conical',
]);

export interface RicMotorImportResult {
  design: MotorDesign;
  errors: string[];
}

export function ricMotorDataFromDesign(design: MotorDesign): unknown {
  return design;
}

export function designFromRicMotorData(data: unknown): RicMotorImportResult {
  const record = data as { grains?: { type: string }[]; propellant?: MotorDesign['propellant']; nozzle?: MotorDesign['nozzle']; config?: MotorDesign['config'] };
  const errors: string[] = [];
  const grains: GrainConfig[] = [];
  for (const grain of record.grains ?? []) {
    if (grain.type === 'Custom Grain') {
      errors.push('Motor contains a Custom Grain (DXF-imported geometry), which this app can’t import — it was skipped.');
      continue;
    }
    if (!KNOWN_GRAIN_TYPES.has(grain.type as GrainConfig['type'])) {
      errors.push(`Motor contains a grain of unknown type "${grain.type}", which was skipped.`);
      continue;
    }
    grains.push(grain as GrainConfig);
  }
  if (!record.nozzle || !record.config) {
    throw new Error('Motor file is missing its nozzle or config section.');
  }
  return {
    design: {
      grains,
      propellant: record.propellant ?? null,
      nozzle: record.nozzle,
      config: record.config,
    },
    errors,
  };
}
