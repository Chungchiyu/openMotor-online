/**
 * Finocyl (fins on cylinder): a circular core with a number of rectangular fins radiating outward
 * (or, for inverted fins, cut inward) from its edge. Ported from motorlib/grains/finocyl.py.
 */
import { SimAlertLevel, SimAlertType, type FinocylProperties, type SimAlert } from '../types';
import { FmmGrain } from './fmmGrain';

export class Finocyl extends FmmGrain {
  numFins = 0;
  finWidth = 0;
  finLength = 0;
  coreDiameter = 0;
  invertedFins = false;

  static fromProperties(props: FinocylProperties): Finocyl {
    const g = new Finocyl();
    g.diameter = props.diameter;
    g.length = props.length;
    g.numFins = props.numFins;
    g.finWidth = props.finWidth;
    g.finLength = props.finLength;
    g.coreDiameter = props.coreDiameter;
    g.invertedFins = props.invertedFins;
    g.inhibitedEnds = props.inhibitedEnds;
    return g;
  }

  toProperties(): FinocylProperties {
    return {
      diameter: this.diameter,
      length: this.length,
      numFins: this.numFins,
      finWidth: this.finWidth,
      finLength: this.finLength,
      coreDiameter: this.coreDiameter,
      invertedFins: this.invertedFins,
      inhibitedEnds: this.inhibitedEnds,
    };
  }

  protected generateCoreMap(): void {
    const coreRadius = this.normalize(this.coreDiameter) / 2;
    const finWidth = this.normalize(this.finWidth);
    const finLength = this.normalize(this.finLength);
    const invertedFins = this.invertedFins;
    const finStart = invertedFins ? coreRadius - finLength : 0;
    const finEnd = invertedFins ? coreRadius : finLength + coreRadius;
    const n = this.mapDim * this.mapDim;

    for (let i = 0; i < n; i++) {
      const x = this.mapX[i];
      const y = this.mapY[i];
      if (x * x + y * y < coreRadius * coreRadius) this.coreMap[i] = 0;
    }

    for (let fin = 0; fin < this.numFins; fin++) {
      const theta = ((2 * Math.PI) / this.numFins) * fin;
      const vect0 = Math.cos(theta);
      const vect1 = Math.sin(theta);
      for (let i = 0; i < n; i++) {
        const x = this.mapX[i];
        const y = this.mapY[i];
        const inFin = Math.abs(vect0 * x + vect1 * y) < finWidth / 2;
        if (!inFin) continue;
        const along = vect1 * x - vect0 * y;
        if (along > finStart && along < finEnd) this.coreMap[i] = invertedFins ? 1 : 0;
      }
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
    if (this.finLength === 0) {
      errors.push({ level: SimAlertLevel.ERROR, type: SimAlertType.GEOMETRY, description: 'Fin length must not be 0' });
    }
    if (this.finLength * 2 > this.diameter) {
      errors.push({
        level: SimAlertLevel.WARNING,
        type: SimAlertType.GEOMETRY,
        description: 'Fin length should be less than or equal to grain radius',
      });
    }
    if (this.invertedFins) {
      const coreRadius = this.coreDiameter / 2;
      // In the weird case of one fin that extends beyond the core, we need to make sure it doesn't
      // intersect the core again on the other side, as that would divide the port.
      if (this.finLength > coreRadius) {
        const lengthPastCenter = this.finLength - coreRadius;
        const halfWidth = this.finWidth / 2;
        const tipRadius = Math.sqrt(lengthPastCenter ** 2 + halfWidth ** 2);
        if (tipRadius > coreRadius && this.numFins > 0) {
          errors.push({ level: SimAlertLevel.ERROR, type: SimAlertType.GEOMETRY, description: 'Fin tips outside of core' });
        }
      }
    } else {
      const coreWidth = this.coreDiameter + 2 * this.finLength;
      if (coreWidth > this.diameter) {
        errors.push({
          level: SimAlertLevel.WARNING,
          type: SimAlertType.GEOMETRY,
          description: 'Core radius plus fin length should be less than or equal to grain radius',
        });
      }
    }
    if (this.finWidth === 0) {
      errors.push({ level: SimAlertLevel.ERROR, type: SimAlertType.GEOMETRY, description: 'Fin width must not be 0' });
    }
    if (this.numFins > 1) {
      const radius = this.coreDiameter / 2;
      const level = this.invertedFins ? SimAlertLevel.ERROR : SimAlertLevel.WARNING;
      const apothem = this.invertedFins ? radius - this.finLength : radius + this.finLength;
      const sideLength = 2 * apothem * Math.tan(Math.PI / this.numFins);
      if (sideLength < this.finWidth) {
        errors.push({ level, type: SimAlertType.GEOMETRY, description: 'Fin tips intersect' });
      }
    }
    return errors;
  }
}
