import { describe, expect, it } from 'vitest';
import { isSelfIntersecting, pointInPolygon, polygonArea, rasterizePolygon } from '../polygonRaster';

describe('polygonArea', () => {
  it('returns the area of an axis-aligned square via the shoelace formula', () => {
    const square: [number, number][] = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];
    expect(polygonArea(square)).toBeCloseTo(4, 10);
  });

  it('returns a positive area regardless of winding direction', () => {
    const clockwise: [number, number][] = [
      [0, 0],
      [0, 2],
      [2, 2],
      [2, 0],
    ];
    expect(polygonArea(clockwise)).toBeCloseTo(4, 10);
  });
});

describe('pointInPolygon', () => {
  const square: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];

  it('reports a point at the center as inside', () => {
    expect(pointInPolygon(square, 0, 0)).toBe(true);
  });

  it('reports a point well outside the bounding box as outside', () => {
    expect(pointInPolygon(square, 5, 5)).toBe(false);
  });

  it('reports a point inside a concave notch as outside', () => {
    // A "C" shape: a square with a rectangular bite taken out of its right side.
    const notched: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, -0.2],
      [0, -0.2],
      [0, 0.2],
      [1, 0.2],
      [1, 1],
      [-1, 1],
    ];
    expect(pointInPolygon(notched, 0.5, 0)).toBe(false);
    expect(pointInPolygon(notched, -0.5, 0)).toBe(true);
  });
});

describe('isSelfIntersecting', () => {
  it('is false for a simple square', () => {
    const square: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    expect(isSelfIntersecting(square)).toBe(false);
  });

  it('is true for a bowtie polygon', () => {
    const bowtie: [number, number][] = [
      [-1, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
    ];
    expect(isSelfIntersecting(bowtie)).toBe(true);
  });
});

describe('rasterizePolygon', () => {
  it('fills only the cells whose center falls inside the polygon', () => {
    const dim = 5;
    // mapX/mapY as fmmGrain.ts builds them: normalized [-1, 1] across the dim x dim grid.
    const mapX = new Float64Array(dim * dim);
    const mapY = new Float64Array(dim * dim);
    for (let r = 0; r < dim; r++) {
      const y = -1 + (2 * r) / (dim - 1);
      for (let c = 0; c < dim; c++) {
        const x = -1 + (2 * c) / (dim - 1);
        mapX[r * dim + c] = x;
        mapY[r * dim + c] = y;
      }
    }
    const coreMap = new Float64Array(dim * dim).fill(1);
    // A square covering the middle 3x3 cells (x,y in [-0.5, 0.5]) with some margin (edges at
    // +-0.6, not landing exactly on a grid point) so which side of the boundary counts as
    // "inside" isn't an ambiguous edge case.
    const square: [number, number][] = [
      [-0.6, -0.6],
      [0.6, -0.6],
      [0.6, 0.6],
      [-0.6, 0.6],
    ];
    rasterizePolygon(coreMap, mapX, mapY, dim, square);

    for (let r = 0; r < dim; r++) {
      for (let c = 0; c < dim; c++) {
        const inside = r >= 1 && r <= 3 && c >= 1 && c <= 3;
        expect(coreMap[r * dim + c]).toBe(inside ? 0 : 1);
      }
    }
  });
});
