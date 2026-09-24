/**
 * One-time migration of the old localStorage "recent files" snapshots (recentFiles.ts) into the new
 * IndexedDB-backed design store, so switching to the file manager doesn't silently lose whatever a
 * returning user already had saved. Runs at most once per browser profile, tracked by its own flag
 * rather than "store is empty" (which would re-import old recent files after the user had
 * deliberately deleted everything from the new store).
 */
import { loadRecentFiles } from '../recentFiles';
import { createDesignRecord } from './designStore';

const MIGRATED_FLAG_KEY = 'openmotor-online:recentFilesMigratedToDb:v1';

export async function migrateLegacyRecentFilesIfNeeded(): Promise<void> {
  try {
    if (window.localStorage.getItem(MIGRATED_FLAG_KEY)) return;
  } catch {
    return;
  }
  const legacy = loadRecentFiles();
  for (const entry of legacy) {
    await createDesignRecord(entry.name, entry.design);
  }
  try {
    window.localStorage.setItem(MIGRATED_FLAG_KEY, 'true');
  } catch {
    // Best-effort, same reasoning as the rest of this project's localStorage use.
  }
}
