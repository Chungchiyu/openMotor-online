/**
 * MOTOR-type `.ric` data ⇄ `MotorDesign`. Python's `Motor.getDict()`/`applyDict()`
 * (motorlib/motor.py) produce/consume exactly the shape `MotorDesign` already uses — same keys,
 * same nesting, same SI units (see types.ts's header comment) — so this is a structural
 * passthrough, with one conversion needed: Python's `Custom Grain` stores its `points` in whatever
 * unit the user last drew/imported in (tracked in a separate `dxfUnit` property), where this port's
 * `CustomGrainProperties` always keeps `points` pre-converted to meters (see types.ts). Import
 * converts once via `dxfUnit` and drops it; export always writes `dxfUnit: 'm'`. A Custom Grain with
 * more than one polygon (Python's own "multiple cores" support, marked experimental there too) keeps
 * only its largest-area polygon on import, with the rest reported as skipped — this port only
 * supports a single closed polygon per grain.
 */
import { polygonArea } from '../physics/polygonRaster';
import type { CustomGrainProperties, GrainConfig, MotorDesign } from '../physics/types';
import { convert } from '../physics/units';

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
  'Custom Grain',
]);

export interface RicMotorImportResult {
  design: MotorDesign;
  errors: string[];
}

export function ricMotorDataFromDesign(design: MotorDesign): unknown {
  return {
    ...design,
    grains: design.grains.map((grain) =>
      grain.type === 'Custom Grain'
        ? { type: grain.type, properties: { ...grain.properties, points: [grain.properties.points], dxfUnit: 'm' } }
        : grain,
    ),
  };
}

function importCustomGrainProperties(raw: Record<string, unknown>, errors: string[]): CustomGrainProperties {
  const dxfUnit = (raw.dxfUnit as string | undefined) ?? 'm';
  const polygons = raw.points as [number, number][][];
  let chosen = polygons[0] ?? [];
  if (polygons.length > 1) {
    chosen = polygons.reduce((largest, p) => (polygonArea(p) > polygonArea(largest) ? p : largest), chosen);
    errors.push(`Custom Grain had ${polygons.length} separate polygons (multi-core custom grains aren't supported) — kept only the largest, the rest were dropped.`);
  }
  return {
    diameter: raw.diameter as number,
    length: raw.length as number,
    inhibitedEnds: raw.inhibitedEnds as CustomGrainProperties['inhibitedEnds'],
    points: chosen.map(([x, y]) => [convert(x, dxfUnit, 'm'), convert(y, dxfUnit, 'm')]),
  };
}

export function designFromRicMotorData(data: unknown): RicMotorImportResult {
  const record = data as { grains?: { type: string; properties: Record<string, unknown> }[]; propellant?: MotorDesign['propellant']; nozzle?: MotorDesign['nozzle']; config?: MotorDesign['config'] };
  const errors: string[] = [];
  const grains: GrainConfig[] = [];
  for (const grain of record.grains ?? []) {
    if (!KNOWN_GRAIN_TYPES.has(grain.type as GrainConfig['type'])) {
      errors.push(`Motor contains a grain of unknown type "${grain.type}", which was skipped.`);
      continue;
    }
    if (grain.type === 'Custom Grain') {
      grains.push({ type: 'Custom Grain', properties: importCustomGrainProperties(grain.properties, errors) });
      continue;
    }
    grains.push(grain as unknown as GrainConfig);
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
