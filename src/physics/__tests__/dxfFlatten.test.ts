import { describe, expect, it } from 'vitest';
import {
  chunksToClosedPolygons,
  flattenArc,
  flattenBulgeSegment,
  flattenEllipse,
  flattenSpline,
  largestPolygon,
} from '../dxfFlatten';
import { polygonArea } from '../polygonRaster';

describe('flattenArc', () => {
  it('samples points that lie on the circle of the given radius', () => {
    const points = flattenArc({ x: 0, y: 0 }, 2, 0, 90);
    for (const [x, y] of points) {
      expect(Math.hypot(x, y)).toBeCloseTo(2, 6);
    }
  });

  it('starts and ends at the expected angles', () => {
    const points = flattenArc({ x: 0, y: 0 }, 1, 0, 90);
    expect(points[0][0]).toBeCloseTo(1, 6);
    expect(points[0][1]).toBeCloseTo(0, 6);
    expect(points[points.length - 1][0]).toBeCloseTo(0, 6);
    expect(points[points.length - 1][1]).toBeCloseTo(1, 6);
  });

  it('wraps correctly when the end angle is smaller than the start angle', () => {
    const points = flattenArc({ x: 0, y: 0 }, 1, 350, 10);
    expect(points[0][0]).toBeCloseTo(Math.cos((350 * Math.PI) / 180), 6);
    expect(points[points.length - 1][0]).toBeCloseTo(Math.cos((10 * Math.PI) / 180), 6);
  });
});

describe('flattenEllipse', () => {
  it('samples points on an axis-aligned ellipse', () => {
    // Major axis along +x with length 4 (endpoint at (2,0)), axis ratio 0.5 -> semi-minor 1.
    const points = flattenEllipse({ x: 0, y: 0 }, { x: 2, y: 0 }, 0.5, 0, 2 * Math.PI);
    for (const [x, y] of points) {
      expect((x * x) / 4 + y * y).toBeCloseTo(1, 3);
    }
  });
});

describe('flattenBulgeSegment', () => {
  it('returns just the two endpoints for a zero bulge (straight segment)', () => {
    const points = flattenBulgeSegment([0, 0], [1, 0], 0);
    expect(points).toEqual([[0, 0], [1, 0]]);
  });

  it('correctly reconstructs a CCW quarter-circle arc (regression: a center-side sign bug canceled out at bulge=1, the semicircle case, but showed up here)', () => {
    // A CCW quarter-turn from (1,0) to (0,1) around the origin has bulge = tan(90deg / 4).
    const bulge = Math.tan(Math.PI / 8);
    const points = flattenBulgeSegment([1, 0], [0, 1], bulge);
    for (const [x, y] of points) {
      expect(Math.hypot(x, y)).toBeCloseTo(1, 6);
    }
    const mid = points[Math.floor(points.length / 2)];
    expect(mid[0]).toBeCloseTo(Math.SQRT1_2, 3);
    expect(mid[1]).toBeCloseTo(Math.SQRT1_2, 3);
  });

  it('represents the same physical arc when endpoints are swapped and the bulge is negated (a documented DXF invariant)', () => {
    const bulge = Math.tan(Math.PI / 8);
    const forward = flattenBulgeSegment([1, 0], [0, 1], bulge);
    const backward = flattenBulgeSegment([0, 1], [1, 0], -bulge);
    expect(backward.length).toBe(forward.length);
    for (let i = 0; i < forward.length; i++) {
      const reversed = backward[backward.length - 1 - i];
      expect(reversed[0]).toBeCloseTo(forward[i][0], 6);
      expect(reversed[1]).toBeCloseTo(forward[i][1], 6);
    }
  });

  it('bulges into the semicircle reached by sweeping counterclockwise from start to end', () => {
    // A bulge of 1 is a semicircle (included angle 180 degrees). DXF's bulge convention is "positive
    // = counterclockwise arc from start to end": going counterclockwise (increasing angle) from
    // (-1,0) [180 deg] to (1,0) [0/360 deg] passes through 270 deg, i.e. (0,-1) — the semicircle
    // below the chord, not above it.
    const points = flattenBulgeSegment([-1, 0], [1, 0], 1);
    const mid = points[Math.floor(points.length / 2)];
    expect(mid[1]).toBeCloseTo(-1, 3);
  });
});

describe('flattenSpline', () => {
  it('reduces to piecewise-linear interpolation for a degree-1 spline', () => {
    const controlPoints: [number, number][] = [
      [0, 0],
      [1, 2],
      [3, 2],
    ];
    const knots = [0, 0, 1, 2, 2];
    const points = flattenSpline(controlPoints, knots, 1, 20);
    // Every sampled point should lie on one of the two line segments.
    for (const [x, y] of points) {
      const onFirstSeg = x >= -1e-9 && x <= 1 + 1e-9 && Math.abs(y - 2 * x) < 1e-6;
      const onSecondSeg = x >= 1 - 1e-9 && x <= 3 + 1e-9 && Math.abs(y - 2) < 1e-6;
      expect(onFirstSeg || onSecondSeg).toBe(true);
    }
    expect(points[0]).toEqual([0, 0]);
    expect(points[points.length - 1]).toEqual([3, 2]);
  });
});

describe('chunksToClosedPolygons', () => {
  it('joins open segments sharing endpoints into one closed contour', () => {
    const chunks: [number, number][][] = [
      [
        [0, 0],
        [1, 0],
      ],
      [
        [1, 1],
        [1, 0],
      ],
      [
        [0, 1],
        [1, 1],
      ],
      [
        [0, 0],
        [0, 1],
      ],
    ];
    const { polygons, openChunks } = chunksToClosedPolygons(chunks);
    expect(openChunks).toHaveLength(0);
    expect(polygons).toHaveLength(1);
    expect(polygonArea(polygons[0])).toBeCloseTo(1, 6);
  });

  it('leaves already-closed chunks (e.g. a circle) as their own polygon', () => {
    const circle: [number, number][] = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 0],
    ];
    const { polygons, openChunks } = chunksToClosedPolygons([circle]);
    expect(openChunks).toHaveLength(0);
    expect(polygons).toHaveLength(1);
  });

  it('reports chunks that never close as open', () => {
    const dangling: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
    ];
    const { polygons, openChunks } = chunksToClosedPolygons([dangling]);
    expect(polygons).toHaveLength(0);
    expect(openChunks).toHaveLength(1);
  });
});

describe('largestPolygon', () => {
  it('picks the polygon with the greatest area', () => {
    const small: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const big: [number, number][] = [
      [0, 0],
      [5, 0],
      [5, 5],
      [0, 5],
    ];
    expect(largestPolygon([small, big])).toBe(big);
  });
});
