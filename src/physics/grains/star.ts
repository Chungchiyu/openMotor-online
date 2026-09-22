/**
 * Star grain: a core shaped like a multi-pointed star. Ported from motorlib/grains/star.py.
 */
import { SimAlertLevel, SimAlertType, type SimAlert, type StarGrainProperties } from '../types';
import { FmmGrain } from './fmmGrain';

export class StarGrain extends FmmGrain {
  numPoints = 0;
  pointLength = 0;
  pointWidth = 0;

  static fromProperties(props: StarGrainProperties): StarGrain {
    const g = new StarGrain();
    g.diameter = props.diameter;
    g.length = props.length;
    g.numPoints = props.numPoints;
    g.pointLength = props.pointLength;
    g.pointWidth = props.pointWidth;
    g.inhibitedEnds = props.inhibitedEnds;
    return g;
  }

  toProperties(): StarGrainProperties {
    return {
      diameter: this.diameter,
      length: this.length,
      numPoints: this.numPoints,
      pointLength: this.pointLength,
      pointWidth: this.pointWidth,
      inhibitedEnds: this.inhibitedEnds,
    };
  }

  protected generateCoreMap(): void {
    const pointWidth = this.normalize(this.pointWidth);
    const pointLength = this.normalize(this.pointLength);
    const n = this.mapDim * this.mapDim;

    for (let p = 0; p < this.numPoints; p++) {
      const theta = ((2 * Math.PI) / this.numPoints) * p;
      const comp0 = Math.cos(theta);
      const comp1 = Math.sin(theta);

      for (let i = 0; i < n; i++) {
        const x = this.mapX[i];
        const y = this.mapY[i];
        const rect = Math.abs(comp0 * x + comp1 * y);
        const width = (pointWidth / 2) * (1 - Math.sqrt(x * x + y * y) / pointLength);
        const inRect = rect < width;
        const near = comp1 * x - comp0 * y > -0.025;
        if (inRect && near) this.coreMap[i] = 0;
      }
    }
  }

  getGeometryErrors(): SimAlert[] {
    const errors = super.getGeometryErrors();
    if (this.numPoints === 0) {
      errors.push({ level: SimAlertLevel.ERROR, type: SimAlertType.GEOMETRY, description: 'Star grain has 0 points' });
    }
    if (this.pointLength === 0) {
      errors.push({ level: SimAlertLevel.ERROR, type: SimAlertType.GEOMETRY, description: 'Point length must not be 0' });
    }
    if (this.pointLength * 2 > this.diameter) {
      errors.push({
        level: SimAlertLevel.WARNING,
        type: SimAlertType.GEOMETRY,
        description: 'Point length should be less than or equal to grain radius',
      });
    }
    if (this.pointWidth === 0) {
      errors.push({ level: SimAlertLevel.ERROR, type: SimAlertType.GEOMETRY, description: 'Point width must not be 0' });
    }
    return errors;
  }
}
