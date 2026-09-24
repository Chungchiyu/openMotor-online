/**
 * PROPELLANTS-type `.ric` data ⇄ the propellant library. Python's `propellantManager.py` stores
 * `data:` as a flat list of `Propellant.getProperties()` dicts — the same shape as `PropellantConfig`
 * — so, like motor.ts, this is a structural passthrough.
 */
import type { PropellantConfig } from '../physics/types';
import { RicFormatError } from './envelope';

export function ricPropellantsDataFromLibrary(library: PropellantConfig[]): unknown {
  return library;
}

export function libraryFromRicPropellantsData(data: unknown): PropellantConfig[] {
  if (!Array.isArray(data)) {
    throw new RicFormatError('Propellant file did not contain a list of propellants.');
  }
  return data as PropellantConfig[];
}
