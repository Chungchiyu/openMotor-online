/**
 * Save/load for motor designs: a localStorage autosave (so a reload doesn't lose work) plus manual
 * JSON export/import for backup and sharing — see the design doc for why both exist.
 */
import type { MotorDesign } from './physics/types';

const STORAGE_KEY = 'openmotor-online:design:v1';
const SAVE_FORMAT_VERSION = 1;

interface SaveFile {
  formatVersion: number;
  design: MotorDesign;
}

export function autosave(design: MotorDesign): void {
  try {
    const payload: SaveFile = { formatVersion: SAVE_FORMAT_VERSION, design };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage can throw in private-browsing/blocked-storage contexts; autosave is a
    // convenience, not a guarantee, so failing silently is fine here.
  }
}

export function loadAutosave(): MotorDesign | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveFile;
    return parsed.design ?? null;
  } catch {
    return null;
  }
}

/** Triggers a browser download of `content` as `filename` — the shared mechanism behind every
 * export (design JSON, .eng, .csv, .bsx, chart PNG). */
export function downloadTextFile(content: string, filename: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadDesign(design: MotorDesign, filename = 'motor.json'): void {
  const payload: SaveFile = { formatVersion: SAVE_FORMAT_VERSION, design };
  downloadTextFile(JSON.stringify(payload, null, 2), filename, 'application/json');
}

export function parseDesignFile(text: string): MotorDesign {
  const parsed = JSON.parse(text) as SaveFile | MotorDesign;
  if ('design' in parsed && 'formatVersion' in parsed) return parsed.design;
  return parsed as MotorDesign;
}
