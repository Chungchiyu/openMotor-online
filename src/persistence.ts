/**
 * Save/load for motor designs: just a localStorage autosave, so a reload doesn't lose work. Stored
 * as `.ric`'s YAML (via exportMotorRic/importMotorRic) rather than plain JSON, so the app has one
 * motor-design format everywhere instead of a separate one just for this.
 */
import type { MotorDesign } from './physics/types';
import { importMotorRic, exportMotorRic } from './ric';

const STORAGE_KEY = 'openmotor-online:design:v1';

export function autosave(design: MotorDesign): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, exportMotorRic(design));
  } catch {
    // localStorage can throw in private-browsing/blocked-storage contexts; autosave is a
    // convenience, not a guarantee, so failing silently is fine here.
  }
}

export function loadAutosave(): MotorDesign | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    return importMotorRic(raw).design;
  } catch {
    // Autosaves written before this app switched to `.ric`/YAML are plain JSON — fall back to
    // that once, so upgrading past this point doesn't discard whatever the user had in progress.
    try {
      return (JSON.parse(raw) as { design?: MotorDesign }).design ?? null;
    } catch {
      return null;
    }
  }
}

/** Triggers a browser download of `content` as `filename` — the shared mechanism behind every
 * export (.ric, .eng, .csv, .bsx, chart PNG). */
export function downloadTextFile(content: string, filename: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const OPEN_RECORD_KEY = 'openmotor-online:openRecordId:v1';

/** Remembers which File Manager record (storage/designStore.ts) is "the open file", so a page
 * reload's autosave restore doesn't sever the connection and turn the next Save into a duplicate. */
export function saveOpenRecordId(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(OPEN_RECORD_KEY, id);
    else window.localStorage.removeItem(OPEN_RECORD_KEY);
  } catch {
    // best-effort, same reasoning as autosave
  }
}

export function loadOpenRecordId(): string | null {
  try {
    return window.localStorage.getItem(OPEN_RECORD_KEY);
  } catch {
    return null;
  }
}
