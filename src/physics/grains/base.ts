/**
 * Base grain classes. Ported from motorlib/grain.py.
 *
 * As in the Python original, `Grain` is the root for any propellant grain shape, and
 * `PerforatedGrain` adds the concept of a core running through the grain. `FmmGrain` (in fmmGrain.ts)
 * further specializes `PerforatedGrain` for shapes whose regression must be found numerically via
 * the fast marching method rather than in closed form.
 */
import * as geometry from '../geometry';
import { maximumRefDiameter, maximumRefLength } from '../constants';
import { SimAlertLevel, SimAlertType, type InhibitedEnds, type SimAlert } from '../types';

export abstract class Grain {
  diameter = 0;
  length = 0;

  /** Amount of propellant volume consumed as the grain regresses from `regDist` to `regDist + dRegDist`. */
  getVolumeSlice(regDist: number, dRegDist: number): number {
    return this.getVolumeAtRegression(regDist) - this.getVolumeAtRegression(regDist + dRegDist);
  }

  abstract getSurfaceAreaAtRegression(regDist: number): number;
  abstract getVolumeAtRegression(regDist: number): number;
  abstract getWebLeft(regDist: number): number;

  isWebLeft(regDist: number, burnoutThres = 0.00001): boolean {
    return this.getWebLeft(regDist) > burnoutThres;
  }

  abstract getMassFlux(massIn: number, dTime: number, regDist: number, dRegDist: number, position: number, density: number): number;

  /** Uses the grain's mass flux method to return the max. Assumes it will be at the port of the grain. */
  getPeakMassFlux(massIn: number, dTime: number, regDist: number, dRegDist: number, density: number): number {
    return this.getMassFlux(massIn, dTime, regDist, dRegDist, this.getEndPositions(regDist)[1], density);
  }

  abstract getEndPositions(regDist: number): [number, number];
  abstract getPortArea(regDist: number): number;

  getRegressedLength(regDist: number): number {
    const [top, bottom] = this.getEndPositions(regDist);
    return bottom - top;
  }

  getGeometryErrors(): SimAlert[] {
    const errors: SimAlert[] = [];
    if (this.diameter === 0) {
      errors.push({ level: SimAlertLevel.ERROR, type: SimAlertType.GEOMETRY, description: 'Diameter must not be 0' });
    }
    if (this.length === 0) {
      errors.push({ level: SimAlertLevel.ERROR, type: SimAlertType.GEOMETRY, description: 'Length must not be 0' });
    }
    return errors;
  }

  getGrainBoundingVolume(): number {
    return geometry.cylinderVolume(this.diameter, this.length);
  }

  getFreeVolume(regDist: number): number {
    return this.getGrainBoundingVolume() - this.getVolumeAtRegression(regDist);
  }

  abstract simulationSetup(config: { mapDim: number }): void;
}

export const clampDiameter = (v: number) => Math.min(Math.max(v, 0), maximumRefDiameter);
export const clampLength = (v: number) => Math.min(Math.max(v, 0), maximumRefLength);

export abstract class PerforatedGrain extends Grain {
  inhibitedEnds: InhibitedEnds = 'Neither';
  /** Max distance from the core to the wall */
  wallWeb = 0;

  getEndPositions(regDist: number): [number, number] {
    switch (this.inhibitedEnds) {
      case 'Neither':
        return [regDist, this.length - regDist];
      case 'Top':
        return [0, this.length - regDist];
      case 'Bottom':
        return [regDist, this.length];
      case 'Both':
        return [0, this.length];
      default:
        throw new Error('Invalid inhibitedEnds value');
    }
  }

  abstract getCorePerimeter(regDist: number): number;
  abstract getFaceArea(regDist: number): number;

  /**
   * Rasterizes this grain's core shape at the current (uncommitted) properties, for the live
   * preview canvas. Independent of `simulationSetup`/the map size used for an actual run — the UI
   * builds a disposable grain instance from the form fields for this, mirroring how the Python
   * original's property editor built a throwaway grain for its live preview widget.
   */
  abstract getPreviewRaster(dim: number): { coreMap: Float64Array; inDomain: Uint8Array };

  getCoreSurfaceArea(regDist: number): number {
    return this.getCorePerimeter(regDist) * this.getRegressedLength(regDist);
  }

  getWebLeft(regDist: number): number {
    const wallLeft = this.wallWeb - regDist;
    if (this.inhibitedEnds === 'Both') return wallLeft;
    return Math.min(this.getRegressedLength(regDist), wallLeft);
  }

  getSurfaceAreaAtRegression(regDist: number): number {
    const faceArea = this.getFaceArea(regDist);
    const coreArea = this.getCoreSurfaceArea(regDist);
    let exposedFaces = 2;
    if (this.inhibitedEnds === 'Top' || this.inhibitedEnds === 'Bottom') exposedFaces = 1;
    if (this.inhibitedEnds === 'Both') exposedFaces = 0;
    return coreArea + exposedFaces * faceArea;
  }

  getVolumeAtRegression(regDist: number): number {
    return this.getFaceArea(regDist) * this.getRegressedLength(regDist);
  }

  getPortArea(regDist: number): number {
    const faceArea = this.getFaceArea(regDist);
    const uncored = geometry.circleArea(this.diameter);
    return uncored - faceArea;
  }

  getMassFlux(massIn: number, dTime: number, regDist: number, dRegDist: number, position: number, density: number): number {
    const diameter = this.diameter;
    const [top0, bottom0] = this.getEndPositions(regDist);

    if (position < top0) {
      return massIn / geometry.circleArea(diameter);
    }
    if (position <= bottom0) {
      let top: number;
      let countedCoreLength: number;
      if (this.inhibitedEnds === 'Top' || this.inhibitedEnds === 'Both') {
        top = 0;
        countedCoreLength = position;
      } else {
        top = this.getFaceArea(regDist + dRegDist) * dRegDist * density;
        countedCoreLength = position - (top0 + dRegDist);
      }
      let core = this.getPortArea(regDist + dRegDist) * countedCoreLength - this.getPortArea(regDist) * countedCoreLength;
      core *= density;
      const massFlow = massIn + (top + core) / dTime;
      return massFlow / this.getPortArea(regDist + dRegDist);
    }
    const massFlow = massIn + (this.getVolumeSlice(regDist, dRegDist) * density) / dTime;
    return massFlow / geometry.circleArea(diameter);
  }

  getGeometryErrors(): SimAlert[] {
    return super.getGeometryErrors();
  }
}
