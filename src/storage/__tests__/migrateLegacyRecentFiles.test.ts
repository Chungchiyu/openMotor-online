import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultMotorConfig, defaultNozzle, type MotorDesign } from '../../physics/types';
import { addRecentFile } from '../../recentFiles';
import { listDesignRecords, resetDesignStoreForTests } from '../designStore';
import { migrateLegacyRecentFilesIfNeeded } from '../migrateLegacyRecentFiles';

function blankDesign(): MotorDesign {
  return { grains: [], propellant: null, nozzle: defaultNozzle(), config: defaultMotorConfig() };
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
    addRecentFile('old-motor.json', blankDesign());
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
