/**
 * Archived: the app's original "Design File (.json)" export/import feature — its own bespoke JSON
 * save format, used before the app settled on `.ric` (see ../ric) as its one motor-file format.
 * Nothing in the app imports this anymore; kept here for reference only.
 */
import type { MotorDesign } from '../physics/types';
import { downloadTextFile } from '../persistence';

interface SaveFile {
  formatVersion: number;
  design: MotorDesign;
}

const SAVE_FORMAT_VERSION = 1;

export function downloadDesign(design: MotorDesign, filename = 'motor.json'): void {
  const payload: SaveFile = { formatVersion: SAVE_FORMAT_VERSION, design };
  downloadTextFile(JSON.stringify(payload, null, 2), filename, 'application/json');
}

export function parseDesignFile(text: string): MotorDesign {
  const parsed = JSON.parse(text) as SaveFile | MotorDesign;
  if ('design' in parsed && 'formatVersion' in parsed) return parsed.design;
  return parsed as MotorDesign;
}
