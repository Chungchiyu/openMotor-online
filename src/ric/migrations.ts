/**
 * Ports `uilib/fileIO.py`'s version-migration chain (`migrations` dict + `doMigration`), verified
 * hop-by-hop against the real Python engine (see PR/commit notes — ground truth was captured by
 * running `fileIO.loadFile` on real and synthetic old-version `.ric` fixtures and diffing against
 * this port's output) rather than transcribed from source alone.
 *
 * One deliberate deviation: `migrateMotor_0_2_0_to_0_3_0` in Python reads
 * `QApplication.instance().preferencesManager` to fill `config` from the *live app's current
 * preferences*, falling back to `DEFAULT_PREFERENCES['general']` only when no app instance exists.
 * That's unreproducible outside a running desktop app (confirmed: it crashes when run headlessly,
 * since `QApplication.instance()` is `None` and has no `.preferencesManager`) — this port always
 * takes the fallback path, using this project's own `defaultMotorConfig()` rather than a literal
 * transcription of `DEFAULT_PREFERENCES['general']`, so a migrated old file gets the same `mapDim`
 * performance deviation as every other design (see types.ts).
 */
import { presetPropellants } from '../physics/presetPropellants';
import { defaultMotorConfig } from '../physics/types';
import { RicFileType, RicFormatError } from './envelope';

type Version = readonly [number, number, number];
// Deliberately untyped: these are Python dict shapes mid-migration, not any current TS type —
// each function's job is exactly to reshape one into the next version's shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RicData = any;
type MigrateFn = (data: RicData) => RicData;

interface MigrationStep {
  to: Version;
  motor: MigrateFn;
  propellants: MigrateFn;
}

const passthrough: MigrateFn = (data) => data;

function tabularizePropellant(data: RicData): RicData {
  return {
    name: data.name,
    density: data.density,
    tabs: [{ a: data.a, n: data.n, k: data.k, t: data.t, m: data.m, minPressure: 0, maxPressure: 1.0342e7 }],
  };
}

function migrateMotor_0_2_0_to_0_3_0(data: RicData): RicData {
  return {
    ...data,
    config: defaultMotorConfig(),
    nozzle: {
      ...data.nozzle,
      divAngle: 15,
      convAngle: 55,
      throatLength: 0.35 * data.nozzle.throat,
    },
  };
}

function migrateMotor_0_3_0_to_0_4_0(data: RicData): RicData {
  return {
    ...data,
    propellant: tabularizePropellant(data.propellant),
    config: { ...data.config, igniterPressure: 150 * 6895 },
  };
}

function migrateMotor_0_4_0_to_0_5_0(data: RicData): RicData {
  const config = { ...data.config };
  if (config.igniterPressure) delete config.igniterPressure;
  return { ...data, config };
}

function migrateMotor_0_5_0_to_0_6_0(data: RicData): RicData {
  return {
    ...data,
    config: { ...data.config, sepPressureRatio: 0.4, flowSeparationWarnPercent: 0.05 },
    grains: data.grains.map((grain: RicData) =>
      grain.type === 'Finocyl' ? { ...grain, properties: { ...grain.properties, invertedFins: false } } : grain,
    ),
  };
}

function migrateMotor_0_6_0_to_0_6_1(data: RicData): RicData {
  return { ...data, config: { ...data.config, maxMachNumber: 0.7 } };
}

function migrateProp_0_3_0_to_0_4_0(data: RicData[]): RicData[] {
  const tabularized = data.map(tabularizePropellant);
  const existingNames = new Set(tabularized.map((p) => p.name));
  const backfilled = presetPropellants.filter((p) => !existingNames.has(p.name));
  return [...tabularized, ...backfilled];
}

function migrateProp_0_4_0_to_0_5_0(data: RicData[]): RicData[] {
  const updated = data.map((p) => {
    if (p.name === 'MIT - Cherry Limeade') return { ...p, density: 1670, tabs: [{ ...p.tabs[0], t: 2800 }, ...p.tabs.slice(1)] };
    if (p.name === 'MIT - Ocean Water') return { ...p, density: 1650, tabs: [{ ...p.tabs[0], t: 2600 }, ...p.tabs.slice(1)] };
    return p;
  });
  if (!updated.some((p) => p.name === 'Nakka - KNSU')) {
    const knsu = presetPropellants.find((p) => p.name === 'Nakka - KNSU');
    if (knsu) updated.push(knsu);
  }
  return updated;
}

function migrateProp_0_6_1_to_0_6_2(data: RicData[]): RicData[] {
  const existingNames = new Set(data.map((p) => p.name));
  const backfilled = presetPropellants.filter((p) => !existingNames.has(p.name));
  return [...data, ...backfilled];
}

const MIGRATIONS: Record<string, MigrationStep> = {
  '0,1,0': { to: [0, 2, 0], motor: passthrough, propellants: passthrough },
  '0,2,0': { to: [0, 3, 0], motor: migrateMotor_0_2_0_to_0_3_0, propellants: passthrough },
  '0,3,0': { to: [0, 4, 0], motor: migrateMotor_0_3_0_to_0_4_0, propellants: migrateProp_0_3_0_to_0_4_0 },
  '0,4,0': { to: [0, 5, 0], motor: migrateMotor_0_4_0_to_0_5_0, propellants: migrateProp_0_4_0_to_0_5_0 },
  '0,5,0': { to: [0, 6, 0], motor: migrateMotor_0_5_0_to_0_6_0, propellants: passthrough },
  '0,6,0': { to: [0, 6, 1], motor: migrateMotor_0_6_0_to_0_6_1, propellants: passthrough },
  '0,6,1': { to: [0, 6, 2], motor: passthrough, propellants: migrateProp_0_6_1_to_0_6_2 },
};

function versionsEqual(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Walks `data` forward one version hop at a time from `fromVersion` to the current app version,
 * matching `doMigration`'s loop — including its failure mode: a version with no entry in the
 * migration table (older than what's ported here, or simply invalid) is a hard error, not a
 * silent no-op, matching Python's `KeyError`. */
export function migrateRicData(type: RicFileType, data: RicData, fromVersion: readonly number[]): RicData {
  if (type !== RicFileType.MOTOR && type !== RicFileType.PROPELLANTS) {
    throw new RicFormatError('Migration is only implemented for MOTOR and PROPELLANTS files.');
  }
  let version = fromVersion;
  let current = data;
  while (!versionsEqual(version, [0, 6, 2])) {
    const step = MIGRATIONS[version.join(',')];
    if (!step) {
      throw new RicFormatError(`No migration available from version ${version.join('.')} — it may predate what this app supports.`);
    }
    current = type === RicFileType.MOTOR ? step.motor(current) : step.propellants(current);
    version = step.to;
  }
  return current;
}
