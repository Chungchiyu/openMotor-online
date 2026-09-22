/**
 * A persistent propellant library, independent of any one motor design — matching the original
 * desktop app's architecture (uilib/propellantManager.py persists a `propellants.yaml` shared
 * across every design, edited through its own "Propellant Editor" window). Stored in localStorage
 * separately from the per-design autosave (see persistence.ts), seeded from the built-in presets
 * the first time the app runs.
 */
import { presetPropellants } from './physics/presetPropellants';
import type { PropellantConfig } from './physics/types';

const STORAGE_KEY = 'openmotor-online:propellants:v1';

function clone(p: PropellantConfig): PropellantConfig {
  return JSON.parse(JSON.stringify(p));
}

export function loadLibrary(): PropellantConfig[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PropellantConfig[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Fall through to reseeding from the defaults below.
  }
  const seeded = presetPropellants.map(clone);
  saveLibrary(seeded);
  return seeded;
}

export function saveLibrary(library: PropellantConfig[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  } catch {
    // Same reasoning as persistence.ts's autosave: this is a convenience, not a guarantee.
  }
}

/** Returns a name not already used in `library`, appending " (2)", " (3)", etc. if needed —
 * mirrors the original's `getUniquePropellantName`. */
export function uniqueName(library: PropellantConfig[], name: string): string {
  const existing = new Set(library.map((p) => p.name));
  if (!existing.has(name)) return name;
  let n = 2;
  while (existing.has(`${name} (${n})`)) n++;
  return `${name} (${n})`;
}

export function findPreset(name: string): PropellantConfig | null {
  return presetPropellants.find((p) => p.name === name) ?? null;
}
