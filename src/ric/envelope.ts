/**
 * The `.ric` envelope: `{version, type, data}`, matching `uilib/fileIO.py`'s `saveFile`/`loadFile`
 * exactly (including its error messages, so a user seeing one isn't looking at unfamiliar wording
 * if they've used the desktop app). See pythonYaml.ts for why the writer hand-emits the `version`/
 * `type` lines instead of letting a generic YAML dumper serialize them.
 */
import { dump } from 'js-yaml';
import { loadRicYaml } from './pythonYaml';

// Matches uilib/fileIO.py's `fileTypes` Enum values exactly.
export const RicFileType = {
  PREFERENCES: 1,
  PROPELLANTS: 2,
  MOTOR: 3,
  RECENT_FILES: 4,
} as const;
export type RicFileType = (typeof RicFileType)[keyof typeof RicFileType];

/** Matches uilib/fileIO.py's `appVersion` — bump this alongside migrations.ts when the Python app
 * introduces a new version this reader/writer needs to understand. */
export const RIC_APP_VERSION: readonly [number, number, number] = [0, 6, 2];

export function writeRicFile(type: RicFileType, data: unknown): string {
  const dataYaml = dump({ data }, { indent: 2, lineWidth: -1 });
  const typeLine = `type: !!python/object/apply:uilib.fileIO.fileTypes [${type}]\n`;
  const versionLine = `version: !!python/tuple [${RIC_APP_VERSION.join(', ')}]\n`;
  return `${dataYaml}${typeLine}${versionLine}`;
}

export class RicFormatError extends Error {}

function isFutureVersion(version: readonly number[], appVersion: readonly number[]): boolean {
  for (let i = 0; i < appVersion.length; i++) {
    const v = version[i] ?? 0;
    const a = appVersion[i] ?? 0;
    if (v !== a) return v > a;
  }
  return false;
}

function versionsEqual(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export interface RicEnvelope {
  version: readonly number[];
  type: RicFileType;
  data: unknown;
}

/** Parses a `.ric` file's envelope without checking type or running migration — used when the
 * caller needs to inspect `type`/`version` before deciding how to handle the file. */
export function parseRicEnvelope(text: string): RicEnvelope {
  const parsed = loadRicYaml(text) as Partial<RicEnvelope> | null;
  if (!parsed || typeof parsed !== 'object' || !('data' in parsed) || !('type' in parsed) || !('version' in parsed)) {
    throw new RicFormatError('File did not contain the required fields. It may be corrupted or from an old version.');
  }
  return parsed as RicEnvelope;
}

/** Reads a `.ric` file of the expected `type`, migrating its `data` forward to the current version
 * if needed. `migrate` is injected (rather than imported directly) so this module stays free of a
 * dependency on the full migration chain — see ric/index.ts for the wiring. */
export function readRicFile(
  text: string,
  expectedType: RicFileType,
  migrate: (type: RicFileType, data: unknown, fromVersion: readonly number[]) => unknown,
): unknown {
  const envelope = parseRicEnvelope(text);
  if (envelope.type !== expectedType) {
    throw new RicFormatError('Loaded data type did not match expected type.');
  }
  if (versionsEqual(envelope.version, RIC_APP_VERSION)) {
    return envelope.data;
  }
  if (isFutureVersion(envelope.version, RIC_APP_VERSION)) {
    throw new RicFormatError(
      `Data is from a future version (${envelope.version.join('.')} vs ${RIC_APP_VERSION.join('.')}) and can't be loaded.`,
    );
  }
  return migrate(expectedType, envelope.data, envelope.version);
}
