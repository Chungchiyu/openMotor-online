/**
 * End Burning grain: a plain cylinder that burns only off one end face, with no core at all.
 * Extends `Grain` directly rather than `PerforatedGrain` — there's no core perimeter/face area to
 * speak of. Ported from motorlib/grains/endBurner.py.
 */
import * as geometry from '../geometry';
import type { EndBurnerProperties } from '../types';
import { Grain } from './base';

export class EndBurningGrain extends Grain {
  static fromProperties(props: EndBurnerProperties): EndBurningGrain {
    const g = new EndBurningGrain();
    g.diameter = props.diameter;
    g.length = props.length;
    return g;
  }

  toProperties(): EndBurnerProperties {
    return { diameter: this.diameter, length: this.length };
  }

  getSurfaceAreaAtRegression(_regDist: number): number {
    return geometry.circleArea(this.diameter);
  }

  getVolumeAtRegression(regDist: number): number {
    const bLength = this.getRegressedLength(regDist);
    return geometry.cylinderVolume(this.diameter, bLength);
  }

  simulationSetup(_config: { mapDim: number }): void {}

  getWebLeft(regDist: number): number {
    return this.getRegressedLength(regDist);
  }

  getMassFlux(_massIn: number, _dTime: number, _regDist: number, _dRegDist: number, _position: number, _density: number): number {
    return 0;
  }

  getPortArea(_regDist: number): number | null {
    return null;
  }

  getEndPositions(regDist: number): [number, number] {
    return [0, this.length - regDist];
  }
}
