/**
 * Legacy "recent files" storage — matching the original desktop app's File > Open Recent
 * (uilib/fileManager.py's `recentFilesList`), adapted for a browser as a small number of complete
 * recent design snapshots (name + timestamp + the design itself) in localStorage. Superseded by the
 * IndexedDB-backed File Manager; `loadRecentFiles` survives only as input to the one-time migration
 * in storage/migrateLegacyRecentFiles.ts that copies existing users' old entries into the new store.
 */
import type { MotorDesign } from './physics/types';

const STORAGE_KEY = 'openmotor-online:recentFiles:v1';

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
