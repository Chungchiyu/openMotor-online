import { describe, expect, it } from 'vitest';
import * as geometry from '../geometry';
import { BatesGrain } from '../grains/bates';

describe('geometry', () => {
  it('circleArea matches pi*r^2', () => {
    expect(geometry.circleArea(1)).toBeCloseTo(Math.PI / 4, 10);
  });

  it('circlePerimeter matches pi*d', () => {
    expect(geometry.circlePerimeter(0.069)).toBeCloseTo(0.069 * Math.PI, 10);
  });

  it('cylinderVolume matches height*circleArea', () => {
    expect(geometry.cylinderVolume(0.069, 0.15)).toBeCloseTo(0.15 * geometry.circleArea(0.069), 10);
  });
});

describe('BatesGrain', () => {
  const grain = BatesGrain.fromProperties({ diameter: 0.069, length: 0.15, coreDiameter: 0.025, inhibitedEnds: 'Neither' });
  grain.simulationSetup({ mapDim: 100 });

  it('computes wallWeb as half the diameter minus core diameter', () => {
    expect(grain.wallWeb).toBeCloseTo((0.069 - 0.025) / 2, 10);
  });

  it('face area at zero regression equals outer minus core circle area', () => {
    const expected = geometry.circleArea(0.069) - geometry.circleArea(0.025);
    expect(grain.getFaceArea(0)).toBeCloseTo(expected, 10);
  });

  it('core perimeter grows with regression', () => {
    expect(grain.getCorePerimeter(0.01)).toBeCloseTo(geometry.circlePerimeter(0.025 + 0.02), 10);
  });

  it('flags geometry errors when core diameter exceeds grain diameter', () => {
    const bad = BatesGrain.fromProperties({ diameter: 0.02, length: 0.1, coreDiameter: 0.05, inhibitedEnds: 'Neither' });
    expect(bad.getGeometryErrors().length).toBeGreaterThan(0);
  });
});
