/**
 * Moon burner grain: very similar to BATES, but with the core offset from center. Ported from
 * motorlib/grains/moonBurner.py. Handled via the fast marching method (like Star), even though the
 * off-center circle-minus-circle geometry does have a closed form — the Python original goes
 * through FmmGrain too, so this stays faithful to that rather than taking a shortcut.
 */
import { SimAlertLevel, SimAlertType, type MoonBurnerProperties, type SimAlert } from '../types';
import { FmmGrain } from './fmmGrain';

export class MoonBurner extends FmmGrain {
  coreDiameter = 0;
  coreOffset = 0;

  static fromProperties(props: MoonBurnerProperties): MoonBurner {
    const g = new MoonBurner();
    g.diameter = props.diameter;
    g.length = props.length;
    g.coreDiameter = props.coreDiameter;
    g.coreOffset = props.coreOffset;
    g.inhibitedEnds = props.inhibitedEnds;
    return g;
  }

  toProperties(): MoonBurnerProperties {
    return {
      diameter: this.diameter,
      length: this.length,
      coreDiameter: this.coreDiameter,
      coreOffset: this.coreOffset,
      inhibitedEnds: this.inhibitedEnds,
    };
  }

  protected generateCoreMap(): void {
    const coreRadius = this.normalize(this.coreDiameter) / 2;
    const coreOffset = this.normalize(this.coreOffset);
    const n = this.mapDim * this.mapDim;
    for (let i = 0; i < n; i++) {
      const x = this.mapX[i] - coreOffset;
      const y = this.mapY[i];
      if (x * x + y * y < coreRadius * coreRadius) this.coreMap[i] = 0;
    }
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
        description: 'Core diameter must be less than or equal to grain diameter',
      });
    }
    if (this.coreOffset * 2 > this.diameter) {
      errors.push({
        level: SimAlertLevel.WARNING,
        type: SimAlertType.GEOMETRY,
        description: 'Core offset should be less than or equal to grain radius',
      });
    }
    return errors;
  }
}
