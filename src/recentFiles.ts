/**
 * "Recent files" — matching the original desktop app's File > Open Recent (uilib/fileManager.py's
 * `recentFilesList`), adapted for a browser: there's no filesystem path to reopen, so this keeps a
 * small number of complete recent design snapshots (name + timestamp + the design itself) in
 * localStorage instead of paths.
 */
import type { MotorDesign } from './physics/types';

const STORAGE_KEY = 'openmotor-online:recentFiles:v1';
const MAX_RECENT = 8;

export interface RecentFileEntry {
  name: string;
  savedAt: number;
  design: MotorDesign;
}

export function loadRecentFiles(): RecentFileEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as RecentFileEntry[];
  } catch {
    // ignore and fall through
  }
  return [];
}

export function addRecentFile(name: string, design: MotorDesign): void {
  try {
    const list = loadRecentFiles().filter((e) => e.name !== name);
    list.unshift({ name, savedAt: Date.now(), design });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // best-effort only, same reasoning as autosave
  }
}
