/**
 * Rod & Tube grain: resembles a BATES grain except that it also features a fully-uninhibited rod
 * of propellant in the center of the core, held in place by a support tube. Kept analytic (not
 * routed through FmmGrain) for the same reason as the Python original — it's just two independent
 * concentric-circle regressions summed, so FMM would only be slower. Ported from
 * motorlib/grains/rodTube.py.
 */
import * as geometry from '../geometry';
import { SimAlertLevel, SimAlertType, type RodTubeGrainProperties, type SimAlert } from '../types';
import { PerforatedGrain } from './base';

export class RodTubeGrain extends PerforatedGrain {
  coreDiameter = 0;
  rodDiameter = 0;
  supportDiameter = 0;
  private tubeWeb = 0;
  private rodWeb = 0;

  static fromProperties(props: RodTubeGrainProperties): RodTubeGrain {
    const g = new RodTubeGrain();
    g.diameter = props.diameter;
    g.length = props.length;
    g.coreDiameter = props.coreDiameter;
    g.rodDiameter = props.rodDiameter;
    g.supportDiameter = props.supportDiameter;
    g.inhibitedEnds = props.inhibitedEnds;
    return g;
  }

  toProperties(): RodTubeGrainProperties {
    return {
      diameter: this.diameter,
      length: this.length,
      coreDiameter: this.coreDiameter,
      rodDiameter: this.rodDiameter,
      supportDiameter: this.supportDiameter,
      inhibitedEnds: this.inhibitedEnds,
    };
  }

  simulationSetup(_config: { mapDim: number }): void {
    this.tubeWeb = (this.diameter - this.coreDiameter) / 2;
    this.rodWeb = (this.rodDiameter - this.supportDiameter) / 2;
    this.wallWeb = Math.max(this.tubeWeb, this.rodWeb);
  }

  getCorePerimeter(regDist: number): number {
    const tubePerimeter = regDist < this.tubeWeb ? geometry.circlePerimeter(this.coreDiameter + 2 * regDist) : 0;
    const rodPerimeter = regDist < this.rodWeb ? geometry.circlePerimeter(this.rodDiameter - 2 * regDist) : 0;
    return tubePerimeter + rodPerimeter;
  }

  getFaceArea(regDist: number): number {
    let tubeArea = 0;
    if (regDist < this.tubeWeb) {
      const outer = geometry.circleArea(this.diameter);
      const inner = geometry.circleArea(this.coreDiameter + 2 * regDist);
      tubeArea = outer - inner;
    }
    let rodArea = 0;
    if (regDist < this.rodWeb) {
      const outer = geometry.circleArea(this.rodDiameter - 2 * regDist);
      const inner = geometry.circleArea(this.supportDiameter);
      rodArea = outer - inner;
    }
    return tubeArea + rodArea;
  }

  getPreviewRaster(dim: number): { coreMap: Float64Array; inDomain: Uint8Array } {
    const coreMap = new Float64Array(dim * dim).fill(1);
    const inDomain = new Uint8Array(dim * dim);
    const halfDiameter = 0.5 * this.diameter;
    const coreRadius = this.coreDiameter / halfDiameter / 2;
    const rodRadius = this.rodDiameter / halfDiameter / 2;
    const supportRadius = this.supportDiameter / halfDiameter / 2;
    for (let r = 0; r < dim; r++) {
      const y = -1 + (2 * r) / (dim - 1);
      for (let c = 0; c < dim; c++) {
        const x = -1 + (2 * c) / (dim - 1);
        const i = r * dim + c;
        const rr = x * x + y * y;
        inDomain[i] = rr <= 1 && rr >= supportRadius * supportRadius ? 1 : 0;
        if (rr < coreRadius * coreRadius) coreMap[i] = 0;
        if (rr < rodRadius * rodRadius) coreMap[i] = 1;
        if (rr < supportRadius * supportRadius) coreMap[i] = 0;
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
    if (this.rodDiameter >= this.coreDiameter) {
      errors.push({ level: SimAlertLevel.ERROR, type: SimAlertType.GEOMETRY, description: 'Rod diameter must be less than core diameter' });
    }
    return errors;
  }
}
