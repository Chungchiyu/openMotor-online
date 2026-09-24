/** Public API for `.ric` (YAML) file compatibility with the Python desktop app — see the module
 * comments in envelope.ts, migrations.ts and motor.ts for how each piece works. */
import type { MotorDesign, PropellantConfig } from '../physics/types';
import { RicFileType, readRicFile, writeRicFile } from './envelope';
import { migrateRicData } from './migrations';
import { designFromRicMotorData, ricMotorDataFromDesign, type RicMotorImportResult } from './motor';
import { libraryFromRicPropellantsData, ricPropellantsDataFromLibrary } from './propellants';

export { RicFormatError } from './envelope';
export type { RicMotorImportResult } from './motor';

export function exportMotorRic(design: MotorDesign): string {
  return writeRicFile(RicFileType.MOTOR, ricMotorDataFromDesign(design));
}

export function importMotorRic(text: string): RicMotorImportResult {
  const data = readRicFile(text, RicFileType.MOTOR, migrateRicData);
  return designFromRicMotorData(data);
}

export function exportPropellantsRic(library: PropellantConfig[]): string {
  return writeRicFile(RicFileType.PROPELLANTS, ricPropellantsDataFromLibrary(library));
}

export function importPropellantsRic(text: string): PropellantConfig[] {
  const data = readRicFile(text, RicFileType.PROPELLANTS, migrateRicData);
  return libraryFromRicPropellantsData(data);
}
