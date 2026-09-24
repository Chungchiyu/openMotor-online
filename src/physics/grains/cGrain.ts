/**
 * C Grain: a cylindrical grain with a single rectangular slot taken out, starting at the casting
 * tube wall and protruding toward the center, stopping a specified offset away. Ported from
 * motorlib/grains/cGrain.py.
 */
import { SimAlertLevel, SimAlertType, type CGrainProperties, type SimAlert } from '../types';
import { FmmGrain } from './fmmGrain';

export class CGrain extends FmmGrain {
  slotWidth = 0;
  slotOffset = 0;

  static fromProperties(props: CGrainProperties): CGrain {
    const g = new CGrain();
    g.diameter = props.diameter;
    g.length = props.length;
    g.slotWidth = props.slotWidth;
    g.slotOffset = props.slotOffset;
    g.inhibitedEnds = props.inhibitedEnds;
    return g;
  }

  toProperties(): CGrainProperties {
    return {
      diameter: this.diameter,
      length: this.length,
      slotWidth: this.slotWidth,
      slotOffset: this.slotOffset,
      inhibitedEnds: this.inhibitedEnds,
    };
  }

  protected generateCoreMap(): void {
    const slotWidth = this.normalize(this.slotWidth);
    const slotOffset = this.normalize(this.slotOffset);
    const n = this.mapDim * this.mapDim;
    for (let i = 0; i < n; i++) {
      if (Math.abs(this.mapY[i]) < slotWidth / 2 && this.mapX[i] > slotOffset) this.coreMap[i] = 0;
    }
  }

  getGeometryErrors(): SimAlert[] {
    const errors = super.getGeometryErrors();
    if (this.slotOffset > this.diameter / 2) {
      errors.push({ level: SimAlertLevel.WARNING, type: SimAlertType.GEOMETRY, description: 'Slot offset should be less than grain radius' });
    }
    if (this.slotOffset < -this.diameter / 2) {
      errors.push({
        level: SimAlertLevel.WARNING,
        type: SimAlertType.GEOMETRY,
        description: 'Slot offset should be greater than negative grain radius',
      });
    }
    if (this.slotWidth === 0) {
      errors.push({ level: SimAlertLevel.WARNING, type: SimAlertType.GEOMETRY, description: 'Slot width must not be 0' });
    }
    if (this.slotWidth > this.diameter) {
      errors.push({
        level: SimAlertLevel.WARNING,
        type: SimAlertType.GEOMETRY,
        description: 'Slot width should not be greater than grain diameter',
      });
    }
    return errors;
  }
}
