import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultMotorConfig, defaultNozzle, type MotorDesign } from '../../physics/types';
import type { RecentFileEntry } from '../../recentFiles';
import { listDesignRecords, resetDesignStoreForTests } from '../designStore';
import { migrateLegacyRecentFilesIfNeeded } from '../migrateLegacyRecentFiles';

const LEGACY_RECENT_FILES_KEY = 'openmotor-online:recentFiles:v1';

function blankDesign(): MotorDesign {
  return { grains: [], propellant: null, nozzle: defaultNozzle(), config: defaultMotorConfig() };
}

// recentFiles.ts no longer exposes a writer (the app only reads its legacy entries for this
// migration now), so seed the same localStorage shape it used to write directly.
function seedLegacyRecentFile(name: string, design: MotorDesign): void {
  const entry: RecentFileEntry = { name, savedAt: Date.now(), design };
  window.localStorage.setItem(LEGACY_RECENT_FILES_KEY, JSON.stringify([entry]));
}

beforeEach(async () => {
  await resetDesignStoreForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('openmotor-online');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  window.localStorage.clear();
});

describe('migrateLegacyRecentFilesIfNeeded', () => {
  it('imports old recentFiles entries into the design store, once', async () => {
    seedLegacyRecentFile('old-motor.json', blankDesign());
    await migrateLegacyRecentFilesIfNeeded();
    expect((await listDesignRecords()).map((r) => r.name)).toEqual(['old-motor.json']);

    // Deleting everything afterwards must not bring old-motor.json back on a second run.
    for (const r of await listDesignRecords()) {
      await (await import('../designStore')).deleteDesignRecord(r.id);
    }
    await migrateLegacyRecentFilesIfNeeded();
    expect(await listDesignRecords()).toEqual([]);
  });

  it('is a no-op when there were no legacy recent files', async () => {
    await migrateLegacyRecentFilesIfNeeded();
    expect(await listDesignRecords()).toEqual([]);
  });
});
