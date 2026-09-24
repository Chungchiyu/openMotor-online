/**
 * Conical grain: similar to a BATES grain except it has different core diameters at each end, so
 * the core is always a frustum (truncated cone). Extends `Grain` directly, like End Burner — the
 * port isn't perpendicular-uniform along the grain's length the way `PerforatedGrain` assumes, so
 * `getMassFlux`/`getEndPositions`/`getPortArea` all need their own frustum-aware math rather than
 * the generic core-perimeter/face-area implementation. Ported from motorlib/grains/conical.py.
 */
import * as geometry from '../geometry';
import { SimAlertLevel, SimAlertType, type ConicalGrainProperties, type InhibitedEnds, type SimAlert } from '../types';
import { Grain } from './base';

/** [forward diameter, aft diameter, length] describing the core frustum at a regression depth. */
type FrustumInfo = [number, number, number];

export class ConicalGrain extends Grain {
  forwardCoreDiameter = 0;
  aftCoreDiameter = 0;
  inhibitedEnds: InhibitedEnds = 'Neither';

  static fromProperties(props: ConicalGrainProperties): ConicalGrain {
    const g = new ConicalGrain();
    g.diameter = props.diameter;
    g.length = props.length;
    g.forwardCoreDiameter = props.forwardCoreDiameter;
    g.aftCoreDiameter = props.aftCoreDiameter;
    g.inhibitedEnds = props.inhibitedEnds;
    return g;
  }

  toProperties(): ConicalGrainProperties {
    return {
      diameter: this.diameter,
      length: this.length,
      forwardCoreDiameter: this.forwardCoreDiameter,
      aftCoreDiameter: this.aftCoreDiameter,
      inhibitedEnds: this.inhibitedEnds,
    };
  }

  /** True if the core's forward diameter is larger than its aft diameter. */
  private isCoreInverted(): boolean {
    return this.forwardCoreDiameter > this.aftCoreDiameter;
  }

  /** The core's dimensions at a given regression depth, as [forward diameter, aft diameter, length]. */
  private getFrustumInfo(regDist: number): FrustumInfo {
    const grainDiameter = this.diameter;
    const aftDiameter = this.aftCoreDiameter;
    const forwardDiameter = this.forwardCoreDiameter;
    const grainLength = this.length;

    const forwardExposed = this.inhibitedEnds === 'Neither' || this.inhibitedEnds === 'Bottom';
    const aftExposed = this.inhibitedEnds === 'Neither' || this.inhibitedEnds === 'Top';

    // These calculations are easiest in terms of the core's "large end" and "small end".
    const inverted = this.isCoreInverted();
    const coreMajorDiameter = inverted ? forwardDiameter : aftDiameter;
    const coreMinorDiameter = inverted ? aftDiameter : forwardDiameter;
    const majorExposed = inverted ? forwardExposed : aftExposed;
    const minorExposed = inverted ? aftExposed : forwardExposed;

    // The core's half angle doesn't change with regression, so it's computed without accounting for it.
    const angle = Math.atan((coreMajorDiameter - coreMinorDiameter) / (2 * grainLength));

    // Expand both core diameters by the radial component of the core's regression vector. This is
    // allowed to expand beyond the casting tube, since that's checked in the next step.
    const regCoreMajorDiameter =
      coreMajorDiameter + regDist * 2 * Math.cos(angle) - (majorExposed ? 1 : 0) * (regDist * 2 * Math.tan(angle));
    const regCoreMinorDiameter =
      coreMinorDiameter + regDist * 2 * Math.cos(angle) + (minorExposed ? 1 : 0) * (regDist * 2 * Math.tan(angle));

    // Once the larger core diameter reaches the casting tube, it clamps there and the length is
    // recomputed to keep the angle constant, accounting for regression at the major end.
    const majorFrustumDiameter = regCoreMajorDiameter >= grainDiameter ? grainDiameter : regCoreMajorDiameter;

    // The minor frustum diameter is never clamped (that point is burnout), so it determines length.
    const minorFrustumDiameter = regCoreMinorDiameter;
    const frustumLength = (majorFrustumDiameter - minorFrustumDiameter) / (2 * Math.tan(angle));

    return inverted ? [majorFrustumDiameter, minorFrustumDiameter, frustumLength] : [minorFrustumDiameter, majorFrustumDiameter, frustumLength];
  }

  getSurfaceAreaAtRegression(regDist: number): number {
    const [forwardDiameter, aftDiameter, length] = this.getFrustumInfo(regDist);
    let surfaceArea = geometry.frustumLateralSurfaceArea(forwardDiameter, aftDiameter, length);

    const fullFaceArea = geometry.circleArea(this.diameter);
    if (this.inhibitedEnds === 'Neither' || this.inhibitedEnds === 'Bottom') {
      surfaceArea += fullFaceArea - geometry.circleArea(forwardDiameter);
    }
    if (this.inhibitedEnds === 'Neither' || this.inhibitedEnds === 'Top') {
      surfaceArea += fullFaceArea - geometry.circleArea(aftDiameter);
    }
    return surfaceArea;
  }

  getVolumeAtRegression(regDist: number): number {
    const [forwardDiameter, aftDiameter, length] = this.getFrustumInfo(regDist);
    const frustumVolume = geometry.frustumVolume(forwardDiameter, aftDiameter, length);
    const outerVolume = geometry.cylinderVolume(this.diameter, length);
    return outerVolume - frustumVolume;
  }

  getWebLeft(regDist: number): number {
    const [forwardDiameter, aftDiameter, length] = this.getFrustumInfo(regDist);
    const wallLeft = (this.diameter - Math.min(aftDiameter, forwardDiameter)) / 2;
    if (this.inhibitedEnds === 'Both') return wallLeft;
    return Math.min(wallLeft, length);
  }

  /** Returns [massFlow, portDiameter] at a point along the grain. */
  private getMassFlowAt(massIn: number, dTime: number, regDist: number, dRegDist: number, position: number, density: number): [number, number] {
    const unsteppedFrustum = this.getFrustumInfo(regDist);
    const steppedFrustum = this.getFrustumInfo(regDist + dRegDist);
    const grainDiameter = this.diameter;
    const aftUninhibited = this.inhibitedEnds === 'Neither' || this.inhibitedEnds === 'Top';
    const foreUninhibited = this.inhibitedEnds === 'Neither' || this.inhibitedEnds === 'Bottom';

    let unsteppedPartialFrustum: FrustumInfo;
    let steppedPartialFrustum: FrustumInfo;
    if (position > dRegDist) {
      [unsteppedPartialFrustum] = geometry.splitFrustum(...unsteppedFrustum, position - dRegDist * (aftUninhibited ? 1 : 0));
      [steppedPartialFrustum] = geometry.splitFrustum(...steppedFrustum, steppedFrustum[2]);
    } else {
      [unsteppedPartialFrustum] = geometry.splitFrustum(...unsteppedFrustum, position + dRegDist * (foreUninhibited ? 1 : 0));
      [steppedPartialFrustum] = geometry.splitFrustum(...steppedFrustum, position);
    }

    const unsteppedFrustumVolume = geometry.frustumVolume(...unsteppedPartialFrustum);
    const steppedFrustumVolume = geometry.frustumVolume(...steppedPartialFrustum);

    const unsteppedPropVolume = geometry.cylinderVolume(grainDiameter, unsteppedPartialFrustum[2]) - unsteppedFrustumVolume;
    const steppedPropVolume = geometry.cylinderVolume(grainDiameter, steppedPartialFrustum[2]) - steppedFrustumVolume;

    let massFlow = ((unsteppedPropVolume - steppedPropVolume) * density) / dTime;
    massFlow += massIn;

    return [massFlow, steppedPartialFrustum[1]];
  }

  getMassFlux(massIn: number, dTime: number, regDist: number, dRegDist: number, position: number, density: number): number {
    const [massFlow, portDiameter] = this.getMassFlowAt(massIn, dTime, regDist, dRegDist, position, density);
    return massFlow / geometry.circleArea(portDiameter);
  }

  /** Overrides the generic `Grain.getPeakMassFlux` (which assumes the peak is at the aft end) —
   * a conical core's port area isn't monotonic along its length, so the peak could be at either
   * exposed end depending on which way the core is inverted. */
  getPeakMassFlux(massIn: number, dTime: number, regDist: number, dRegDist: number, density: number): number {
    const [, , length] = this.getFrustumInfo(regDist);
    const forwardMassFlux = this.getMassFlux(massIn, dTime, regDist, dRegDist, 0, density);
    const aftMassFlux = this.getMassFlux(massIn, dTime, regDist, dRegDist, length, density);
    return Math.max(forwardMassFlux, aftMassFlux);
  }

  getEndPositions(regDist: number): [number, number] {
    const originalLength = this.length;
    const grainDiameter = this.diameter;
    const [forwardCoreDiameter, aftCoreDiameter, currentLength] = this.getFrustumInfo(regDist);

    const forwardExposed = this.inhibitedEnds === 'Neither' || this.inhibitedEnds === 'Bottom';
    const aftExposed = this.inhibitedEnds === 'Neither' || this.inhibitedEnds === 'Top';

    const inverted = this.isCoreInverted();
    const coreMajorDiameter = inverted ? forwardCoreDiameter : aftCoreDiameter;
    const minorExposed = inverted ? aftExposed : forwardExposed;

    if (coreMajorDiameter < grainDiameter) {
      const forwardRegression = (forwardExposed ? 1 : 0) * regDist;
      const aftRegression = (aftExposed ? 1 : 0) * regDist;
      return [forwardRegression, originalLength - aftRegression];
    }
    const minorRegression = (minorExposed ? 1 : 0) * regDist;
    const majorRegression = originalLength - currentLength - minorRegression;
    const [forwardRegression, aftRegression] = inverted ? [majorRegression, minorRegression] : [minorRegression, majorRegression];
    return [forwardRegression, originalLength - aftRegression];
  }

  getPortArea(regDist: number): number {
    const [, aftCoreDiameter] = this.getFrustumInfo(regDist);
    return geometry.circleArea(aftCoreDiameter);
  }

  simulationSetup(_config: { mapDim: number }): void {}

  getGeometryErrors(): SimAlert[] {
    const errors = super.getGeometryErrors();
    if (this.aftCoreDiameter === this.forwardCoreDiameter) {
      errors.push({
        level: SimAlertLevel.ERROR,
        type: SimAlertType.GEOMETRY,
        description: 'Core diameters cannot be the same, use a BATES for this case.',
      });
    }
    if (this.aftCoreDiameter > this.diameter) {
      errors.push({ level: SimAlertLevel.ERROR, type: SimAlertType.GEOMETRY, description: 'Aft core diameter cannot be larger than grain diameter.' });
    }
    if (this.forwardCoreDiameter > this.diameter) {
      errors.push({
        level: SimAlertLevel.ERROR,
        type: SimAlertType.GEOMETRY,
        description: 'Forward core diameter cannot be larger than grain diameter.',
      });
    }
    return errors;
  }
}
