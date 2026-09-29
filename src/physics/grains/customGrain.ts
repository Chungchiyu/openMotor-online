/**
 * Custom grain: an arbitrary closed-polygon core, drawn by hand or imported from a DXF file.
 * Ported from motorlib/grains/custom.py, minus the multi-polygon support (marked "experimental" in
 * Python too — see CustomGrainProperties in types.ts).
 */
import { isSelfIntersecting, polygonArea, rasterizePolygon, type Point } from '../polygonRaster';
import { SimAlertLevel, SimAlertType, type CustomGrainProperties, type SimAlert } from '../types';
import { FmmGrain } from './fmmGrain';

export class CustomGrain extends FmmGrain {
  points: [number, number][] = [];

  static fromProperties(props: CustomGrainProperties): CustomGrain {
    const g = new CustomGrain();
    g.diameter = props.diameter;
    g.length = props.length;
    g.inhibitedEnds = props.inhibitedEnds;
    g.points = props.points;
    return g;
  }

  toProperties(): CustomGrainProperties {
    return {
      diameter: this.diameter,
      length: this.length,
      inhibitedEnds: this.inhibitedEnds,
      points: this.points,
    };
  }

  protected generateCoreMap(): void {
    const polygon: Point[] = this.points.map(([x, y]) => [this.normalize(x), this.normalize(y)]);
    rasterizePolygon(this.coreMap, this.mapX, this.mapY, this.mapDim, polygon);
  }

  getGeometryErrors(): SimAlert[] {
    const errors = super.getGeometryErrors();
    if (this.points.length < 3) {
      errors.push({ level: SimAlertLevel.ERROR, type: SimAlertType.GEOMETRY, description: 'Custom grain needs at least 3 points' });
      return errors;
    }

    const polygon: Point[] = this.points.map(([x, y]) => [this.normalize(x), this.normalize(y)]);
    if (polygonArea(polygon) < 1e-9) {
      errors.push({ level: SimAlertLevel.ERROR, type: SimAlertType.GEOMETRY, description: 'Custom grain polygon has zero area' });
    }
    if (isSelfIntersecting(polygon)) {
      errors.push({
        level: SimAlertLevel.WARNING,
        type: SimAlertType.GEOMETRY,
        description: 'Custom grain polygon has self-intersecting edges, which may produce an unexpected core shape',
      });
    }
    if (polygon.some(([x, y]) => x * x + y * y > 1)) {
      errors.push({
        level: SimAlertLevel.WARNING,
        type: SimAlertType.GEOMETRY,
        description: 'Custom grain polygon extends past the grain diameter — the excess will be clipped',
      });
    }
    return errors;
  }
}
