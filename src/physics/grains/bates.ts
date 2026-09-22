/**
 * BATES grain: a simple cylindrical core, handled analytically rather than through the fast
 * marching method (matches the Python original's reasoning — it's easy enough to do in closed
 * form, and skipping the regression map keeps it cheap). Ported from motorlib/grains/bates.py.
 */
import * as geometry from '../geometry';
import { SimAlertLevel, SimAlertType, type BatesGrainProperties, type SimAlert } from '../types';
import { PerforatedGrain } from './base';

export class BatesGrain extends PerforatedGrain {
  coreDiameter = 0;

  static fromProperties(props: BatesGrainProperties): BatesGrain {
    const g = new BatesGrain();
    g.diameter = props.diameter;
    g.length = props.length;
    g.coreDiameter = props.coreDiameter;
    g.inhibitedEnds = props.inhibitedEnds;
    return g;
  }

  toProperties(): BatesGrainProperties {
    return {
      diameter: this.diameter,
      length: this.length,
      coreDiameter: this.coreDiameter,
      inhibitedEnds: this.inhibitedEnds,
    };
  }

  simulationSetup(_config: { mapDim: number }): void {
    this.wallWeb = (this.diameter - this.coreDiameter) / 2;
  }

  getCorePerimeter(regDist: number): number {
    return geometry.circlePerimeter(this.coreDiameter + 2 * regDist);
  }

  getFaceArea(regDist: number): number {
    const outer = geometry.circleArea(this.diameter);
    const inner = geometry.circleArea(this.coreDiameter + 2 * regDist);
    return outer - inner;
  }

  getPreviewRaster(dim: number): { coreMap: Float64Array; inDomain: Uint8Array } {
    const coreMap = new Float64Array(dim * dim).fill(1);
    const inDomain = new Uint8Array(dim * dim);
    const coreRadius = this.coreDiameter / (0.5 * this.diameter) / 2;
    for (let r = 0; r < dim; r++) {
      const y = -1 + (2 * r) / (dim - 1);
      for (let c = 0; c < dim; c++) {
        const x = -1 + (2 * c) / (dim - 1);
        const i = r * dim + c;
        inDomain[i] = x * x + y * y <= 1 ? 1 : 0;
        if (x * x + y * y < coreRadius * coreRadius) coreMap[i] = 0;
      }
    }
    return { coreMap, inDomain };
  }

  getGeometryErrors(): SimAlert[] {
    const errors = super.getGeometryErrors();
    if (this.coreDiameter === 0) {
      errors.push({ level: SimAlertLevel.ERROR, type: SimAlertType.GEOMETRY, description: 'Core diameter must not be 0' });
    }
    if (this.coreDiameter >= this.diameter) {
      errors.push({
        level: SimAlertLevel.ERROR,
        type: SimAlertType.GEOMETRY,
        description: 'Core diameter must be less than grain diameter',
      });
    }
    return errors;
  }
}
