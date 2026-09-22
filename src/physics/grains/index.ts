import type { GrainConfig } from '../types';
import { BatesGrain } from './bates';
import type { Grain } from './base';
import { MoonBurner } from './moonBurner';
import { StarGrain } from './star';

export { BatesGrain } from './bates';
export { StarGrain } from './star';
export { MoonBurner } from './moonBurner';
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
  throw new Error('Unknown grain instance');
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
    default: {
      const exhaustive: never = type;
      throw new Error(`Unknown grain type: ${exhaustive}`);
    }
  }
}
