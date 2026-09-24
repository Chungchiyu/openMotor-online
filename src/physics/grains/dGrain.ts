/**
 * D Grain: no propellant past a chord line at a user-specified offset from the diameter. Ported
 * from motorlib/grains/dGrain.py.
 */
import { SimAlertLevel, SimAlertType, type DGrainProperties, type SimAlert } from '../types';
import { FmmGrain } from './fmmGrain';

export class DGrain extends FmmGrain {
  slotOffset = 0;

  static fromProperties(props: DGrainProperties): DGrain {
    const g = new DGrain();
    g.diameter = props.diameter;
    g.length = props.length;
    g.slotOffset = props.slotOffset;
    g.inhibitedEnds = props.inhibitedEnds;
    return g;
  }

  toProperties(): DGrainProperties {
    return {
      diameter: this.diameter,
      length: this.length,
      slotOffset: this.slotOffset,
      inhibitedEnds: this.inhibitedEnds,
    };
  }

  protected generateCoreMap(): void {
    const slotOffset = this.normalize(this.slotOffset);
    const n = this.mapDim * this.mapDim;
    for (let i = 0; i < n; i++) {
      if (this.mapX[i] > slotOffset) this.coreMap[i] = 0;
    }
  }

  getGeometryErrors(): SimAlert[] {
    const errors = super.getGeometryErrors();
    if (this.slotOffset > this.diameter / 2) {
      errors.push({
        level: SimAlertLevel.ERROR,
        type: SimAlertType.GEOMETRY,
        description: 'Core offset must not be greater than grain radius',
      });
    }
    if (this.slotOffset < -this.diameter / 2) {
      errors.push({
        level: SimAlertLevel.ERROR,
        type: SimAlertType.GEOMETRY,
        description: 'Core offset must be greater than negative grain radius',
      });
    }
    return errors;
  }
}
