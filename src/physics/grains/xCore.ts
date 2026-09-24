/**
 * X Core: a core shaped like a plus sign, formed from two perpendicular rectangular slots crossing
 * through the center. Ported from motorlib/grains/xCore.py.
 */
import { SimAlertLevel, SimAlertType, type SimAlert, type XCoreProperties } from '../types';
import { FmmGrain } from './fmmGrain';

export class XCore extends FmmGrain {
  slotWidth = 0;
  slotLength = 0;

  static fromProperties(props: XCoreProperties): XCore {
    const g = new XCore();
    g.diameter = props.diameter;
    g.length = props.length;
    g.slotWidth = props.slotWidth;
    g.slotLength = props.slotLength;
    g.inhibitedEnds = props.inhibitedEnds;
    return g;
  }

  toProperties(): XCoreProperties {
    return {
      diameter: this.diameter,
      length: this.length,
      slotWidth: this.slotWidth,
      slotLength: this.slotLength,
      inhibitedEnds: this.inhibitedEnds,
    };
  }

  protected generateCoreMap(): void {
    const slotWidth = this.normalize(this.slotWidth);
    const slotLength = this.normalize(this.slotLength);
    const n = this.mapDim * this.mapDim;
    for (let i = 0; i < n; i++) {
      const x = this.mapX[i];
      const y = this.mapY[i];
      if (Math.abs(y) < slotWidth / 2 && Math.abs(x) < slotLength) this.coreMap[i] = 0;
      if (Math.abs(x) < slotWidth / 2 && Math.abs(y) < slotLength) this.coreMap[i] = 0;
    }
  }

  getGeometryErrors(): SimAlert[] {
    const errors = super.getGeometryErrors();
    if (this.slotWidth === 0) {
      errors.push({ level: SimAlertLevel.ERROR, type: SimAlertType.GEOMETRY, description: 'Slot width must not be 0' });
    }
    if (this.slotWidth > this.diameter) {
      errors.push({
        level: SimAlertLevel.WARNING,
        type: SimAlertType.GEOMETRY,
        description: 'Slot width should be less than or equal to grain diameter',
      });
    }
    if (this.slotLength === 0) {
      errors.push({ level: SimAlertLevel.ERROR, type: SimAlertType.GEOMETRY, description: 'Slot length must not be 0' });
    }
    if (this.slotLength * 2 > this.diameter) {
      errors.push({
        level: SimAlertLevel.WARNING,
        type: SimAlertType.GEOMETRY,
        description: 'Slot length should be less than or equal to grain radius',
      });
    }
    return errors;
  }
}
