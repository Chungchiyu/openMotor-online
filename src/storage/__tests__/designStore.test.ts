import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultMotorConfig, defaultNozzle, type MotorDesign } from '../../physics/types';
import {
  createDesignRecord,
  deleteDesignRecord,
  duplicateDesignRecord,
  getDesignRecord,
  listDesignRecords,
  resetDesignStoreForTests,
  updateDesignRecord,
} from '../designStore';

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
});

describe('designStore', () => {
  it('creates and lists a design, newest first', async () => {
    const a = await createDesignRecord('First', blankDesign());
    await new Promise((r) => setTimeout(r, 2));
    const b = await createDesignRecord('Second', blankDesign());
    const list = await listDesignRecords();
    expect(list.map((r) => r.id)).toEqual([b.id, a.id]);
  });

  it('gets a design by id', async () => {
    const created = await createDesignRecord('Motor', blankDesign(), ['test']);
    const fetched = await getDesignRecord(created.id);
    expect(fetched?.name).toBe('Motor');
    expect(fetched?.tags).toEqual(['test']);
  });

  it('updates a design, bumping updatedAt but preserving createdAt', async () => {
    const created = await createDesignRecord('Motor', blankDesign());
    await new Promise((r) => setTimeout(r, 2));
    const updated = await updateDesignRecord(created.id, { name: 'Renamed' });
    expect(updated.name).toBe('Renamed');
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
  });

  it('deletes a design', async () => {
    const created = await createDesignRecord('Motor', blankDesign());
    await deleteDesignRecord(created.id);
    expect(await getDesignRecord(created.id)).toBeUndefined();
  });

  it('duplicates a design under a new name, as a separate record', async () => {
    const design = { ...blankDesign(), config: { ...defaultMotorConfig(), mapDim: 999 } };
    const created = await createDesignRecord('Original', design, ['a']);
    const dup = await duplicateDesignRecord(created.id, 'Original (copy)');
    expect(dup.id).not.toBe(created.id);
    expect(dup.name).toBe('Original (copy)');
    expect(dup.design).toEqual(design);
    expect(dup.tags).toEqual(['a']);
    expect((await listDesignRecords()).map((r) => r.id).sort()).toEqual([created.id, dup.id].sort());
  });

  it('throws when updating or duplicating a nonexistent id', async () => {
    await expect(updateDesignRecord('missing', { name: 'x' })).rejects.toThrow();
    await expect(duplicateDesignRecord('missing', 'x')).rejects.toThrow();
  });
});
