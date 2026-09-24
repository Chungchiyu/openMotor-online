import type { GrainConfig } from '../types';
import { BatesGrain } from './bates';
import type { Grain } from './base';
import { CGrain } from './cGrain';
import { DGrain } from './dGrain';
import { ConicalGrain } from './conical';
import { EndBurningGrain } from './endBurner';
import { Finocyl } from './finocyl';
import { MoonBurner } from './moonBurner';
import { RodTubeGrain } from './rodTube';
import { StarGrain } from './star';
import { XCore } from './xCore';

export { BatesGrain } from './bates';
export { StarGrain } from './star';
export { MoonBurner } from './moonBurner';
export { DGrain } from './dGrain';
export { XCore } from './xCore';
export { CGrain } from './cGrain';
export { Finocyl } from './finocyl';
export { RodTubeGrain } from './rodTube';
export { EndBurningGrain } from './endBurner';
export { ConicalGrain } from './conical';
export { Grain, PerforatedGrain } from './base';
export { FmmGrain } from './fmmGrain';

export function buildGrain(config: GrainConfig): Grain {
  switch (config.type) {
    case 'BATES':
      return BatesGrain.fromProperties(config.properties);
    case 'Star Grain':
      return StarGrain.fromProperties(config.properties);
    case 'Moon Burner':
      return MoonBurner.fromProperties(config.properties);
    case 'D Grain':
      return DGrain.fromProperties(config.properties);
    case 'X Core':
      return XCore.fromProperties(config.properties);
    case 'C Grain':
      return CGrain.fromProperties(config.properties);
    case 'Finocyl':
      return Finocyl.fromProperties(config.properties);
    case 'Rod and Tube':
      return RodTubeGrain.fromProperties(config.properties);
    case 'End Burner':
      return EndBurningGrain.fromProperties(config.properties);
    case 'Conical':
      return ConicalGrain.fromProperties(config.properties);
    default: {
      const exhaustive: never = config;
      throw new Error(`Unknown grain type: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function grainToConfig(grain: Grain): GrainConfig {
  if (grain instanceof BatesGrain) return { type: 'BATES', properties: grain.toProperties() };
  if (grain instanceof StarGrain) return { type: 'Star Grain', properties: grain.toProperties() };
  if (grain instanceof MoonBurner) return { type: 'Moon Burner', properties: grain.toProperties() };
  if (grain instanceof DGrain) return { type: 'D Grain', properties: grain.toProperties() };
  if (grain instanceof XCore) return { type: 'X Core', properties: grain.toProperties() };
  if (grain instanceof CGrain) return { type: 'C Grain', properties: grain.toProperties() };
  if (grain instanceof Finocyl) return { type: 'Finocyl', properties: grain.toProperties() };
  if (grain instanceof RodTubeGrain) return { type: 'Rod and Tube', properties: grain.toProperties() };
  if (grain instanceof EndBurningGrain) return { type: 'End Burner', properties: grain.toProperties() };
  if (grain instanceof ConicalGrain) return { type: 'Conical', properties: grain.toProperties() };
  throw new Error('Unknown grain instance');
}

/**
 * Rebuilds a grain from its own properties into a fresh instance.
 *
 * Used before any call that mutates a grain's internal geometry cache (e.g. `getPreviewRaster`,
 * which resets `FmmGrain`'s `mapDim`/`coreMap`/lookup tables to a small preview resolution) when the
 * grain in hand is one still owned by a live `SimulationResult` — calling such a method directly on
 * that shared instance corrupts the tables the simulation itself relies on (see `getPortArea` ->
 * `getFaceArea`, which throws once they're gone). A cheap, independent copy sidesteps that instead
 * of having to make every geometry-cache method defensive.
 */
export function cloneGrain(grain: Grain): Grain {
  return buildGrain(grainToConfig(grain));
}

export function defaultGrainConfig(type: GrainConfig['type']): GrainConfig {
  switch (type) {
    case 'BATES':
      return { type: 'BATES', properties: { diameter: 0.069, length: 0.15, coreDiameter: 0.025, inhibitedEnds: 'Neither' } };
    case 'Star Grain':
      return {
        type: 'Star Grain',
        properties: { diameter: 0.069, length: 0.15, numPoints: 6, pointLength: 0.02, pointWidth: 0.008, inhibitedEnds: 'Neither' },
      };
    case 'Moon Burner':
      return {
        type: 'Moon Burner',
        properties: { diameter: 0.069, length: 0.15, coreDiameter: 0.02, coreOffset: 0.015, inhibitedEnds: 'Neither' },
      };
    case 'D Grain':
      return {
        type: 'D Grain',
        properties: { diameter: 0.069, length: 0.15, slotOffset: 0, inhibitedEnds: 'Neither' },
      };
    case 'X Core':
      return {
        type: 'X Core',
        properties: { diameter: 0.069, length: 0.15, slotWidth: 0.01, slotLength: 0.02, inhibitedEnds: 'Neither' },
      };
    case 'C Grain':
      return {
        type: 'C Grain',
        properties: { diameter: 0.069, length: 0.15, slotWidth: 0.01, slotOffset: 0, inhibitedEnds: 'Neither' },
      };
    case 'Finocyl':
      return {
        type: 'Finocyl',
        properties: {
          diameter: 0.069,
          length: 0.15,
          numFins: 4,
          finWidth: 0.005,
          finLength: 0.015,
          coreDiameter: 0.02,
          invertedFins: false,
          inhibitedEnds: 'Neither',
        },
      };
    case 'Rod and Tube':
      return {
        type: 'Rod and Tube',
        properties: { diameter: 0.069, length: 0.15, coreDiameter: 0.04, rodDiameter: 0.02, supportDiameter: 0.005, inhibitedEnds: 'Neither' },
      };
    case 'End Burner':
      return { type: 'End Burner', properties: { diameter: 0.069, length: 0.15 } };
    case 'Conical':
      return {
        type: 'Conical',
        properties: { diameter: 0.069, length: 0.15, forwardCoreDiameter: 0.01, aftCoreDiameter: 0.03, inhibitedEnds: 'Neither' },
      };
    default: {
      const exhaustive: never = type;
      throw new Error(`Unknown grain type: ${exhaustive}`);
    }
  }
}
