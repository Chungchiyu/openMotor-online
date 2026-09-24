/**
 * IndexedDB-backed store for saved motor designs — the "file manager" list, replacing the old
 * localStorage `recentFiles.ts` (which held at most 8 full-design snapshots with no browsing,
 * rename, or tagging). IndexedDB has no practical size cap and lets us index by tag/name/date for
 * the file manager UI, at the cost of an async API everywhere localStorage was synchronous.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { MotorDesign } from '../physics/types';

const DB_NAME = 'openmotor-online';
const DB_VERSION = 1;
const STORE_NAME = 'designs';

export interface DesignRecord {
  id: string;
  name: string;
  tags: string[];
  design: MotorDesign;
  createdAt: number;
  updatedAt: number;
}

interface DesignDbSchema extends DBSchema {
  designs: {
    key: string;
    value: DesignRecord;
    indexes: { 'by-updatedAt': number; 'by-tag': string };
  };
}

let dbPromise: Promise<IDBPDatabase<DesignDbSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<DesignDbSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<DesignDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by-updatedAt', 'updatedAt');
        store.createIndex('by-tag', 'tags', { multiEntry: true });
      },
    });
  }
  return dbPromise;
}

function newId(): string {
  return crypto.randomUUID();
}

/** Newest-first, matching the old recent-files ordering. */
export async function listDesignRecords(): Promise<DesignRecord[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex(STORE_NAME, 'by-updatedAt');
  return all.reverse();
}

export async function getDesignRecord(id: string): Promise<DesignRecord | undefined> {
  const db = await getDb();
  return db.get(STORE_NAME, id);
}

export async function createDesignRecord(name: string, design: MotorDesign, tags: string[] = []): Promise<DesignRecord> {
  const db = await getDb();
  const now = Date.now();
  const record: DesignRecord = { id: newId(), name, tags, design, createdAt: now, updatedAt: now };
  await db.put(STORE_NAME, record);
  return record;
}

export async function updateDesignRecord(
  id: string,
  patch: Partial<Pick<DesignRecord, 'name' | 'tags' | 'design'>>,
): Promise<DesignRecord> {
  const db = await getDb();
  const existing = await db.get(STORE_NAME, id);
  if (!existing) throw new Error(`No saved design with id ${id}`);
  const updated: DesignRecord = { ...existing, ...patch, updatedAt: Date.now() };
  await db.put(STORE_NAME, updated);
  return updated;
}

export async function deleteDesignRecord(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, id);
}

export async function duplicateDesignRecord(id: string, newName: string): Promise<DesignRecord> {
  const existing = await getDesignRecord(id);
  if (!existing) throw new Error(`No saved design with id ${id}`);
  return createDesignRecord(newName, existing.design, existing.tags);
}

/** Only for tests — closes the current connection so a following `indexedDB.deleteDatabase()`
 * doesn't block waiting for it, then lets the next call to `getDb()` open a fresh one. */
export async function resetDesignStoreForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
  }
  dbPromise = null;
}
