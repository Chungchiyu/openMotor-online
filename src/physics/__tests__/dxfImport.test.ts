import { describe, expect, it } from 'vitest';
import { importDxfPolygon } from '../dxfImport';
import { polygonArea } from '../polygonRaster';

function dxfWithEntities(entityLines: string): string {
  return `0\nSECTION\n2\nENTITIES\n${entityLines}0\nENDSEC\n0\nEOF\n`;
}

describe('importDxfPolygon', () => {
  it('joins four LINE entities forming a square into one closed polygon', () => {
    const text = dxfWithEntities(
      [
        '0\nLINE\n8\n0\n10\n0.0\n20\n0.0\n11\n1.0\n21\n0.0\n',
        '0\nLINE\n8\n0\n10\n1.0\n20\n0.0\n11\n1.0\n21\n1.0\n',
        '0\nLINE\n8\n0\n10\n1.0\n20\n1.0\n11\n0.0\n21\n1.0\n',
        '0\nLINE\n8\n0\n10\n0.0\n20\n1.0\n11\n0.0\n21\n0.0\n',
      ].join(''),
    );
    const result = importDxfPolygon(text);
    expect(result.errors).toHaveLength(0);
    expect(result.points).not.toBeNull();
    expect(polygonArea(result.points!)).toBeCloseTo(1, 6);
  });

  it('imports a single CIRCLE entity as a closed polygon approximating that circle', () => {
    const text = dxfWithEntities('0\nCIRCLE\n8\n0\n10\n0.0\n20\n0.0\n40\n2.0\n');
    const result = importDxfPolygon(text);
    expect(result.errors).toHaveLength(0);
    expect(result.points).not.toBeNull();
    expect(polygonArea(result.points!)).toBeCloseTo(Math.PI * 4, 1);
  });

  it('keeps only the largest of several closed contours, with a warning', () => {
    const text = dxfWithEntities(['0\nCIRCLE\n8\n0\n10\n0.0\n20\n0.0\n40\n1.0\n', '0\nCIRCLE\n8\n0\n10\n10.0\n20\n10.0\n40\n5.0\n'].join(''));
    const result = importDxfPolygon(text);
    expect(result.points).not.toBeNull();
    expect(polygonArea(result.points!)).toBeCloseTo(Math.PI * 25, 0);
    expect(result.errors.some((e) => /2 separate closed contours/.test(e))).toBe(true);
  });

  it('reports an unsupported entity type but keeps going', () => {
    const text = dxfWithEntities(
      ['0\nCIRCLE\n8\n0\n10\n0.0\n20\n0.0\n40\n1.0\n', '0\nTEXT\n8\n0\n10\n0.0\n20\n0.0\n40\n1.0\n1\nhello\n'].join(''),
    );
    const result = importDxfPolygon(text);
    expect(result.points).not.toBeNull();
    expect(result.errors.some((e) => /unsupported entity type: TEXT/.test(e))).toBe(true);
  });

  it('flattens a closed LWPOLYLINE with bulged (arc) segments into a circle-shaped polygon', () => {
    // Two vertices, each with bulge 1 (a semicircle) to the next, closed -> a full circle of
    // radius 1 made from two semicircular LWPOLYLINE segments (a common way CAD tools export a
    // "rounded" core, and a real exercise of both the bulge math and the closed-shape flag).
    const text = dxfWithEntities(
      '0\nLWPOLYLINE\n8\n0\n90\n2\n70\n1\n10\n-1.0\n20\n0.0\n42\n1.0\n10\n1.0\n20\n0.0\n42\n1.0\n',
    );
    const result = importDxfPolygon(text);
    expect(result.errors).toHaveLength(0);
    expect(result.points).not.toBeNull();
    expect(polygonArea(result.points!)).toBeCloseTo(Math.PI, 2);
  });

  it('reports failure when nothing closes into a polygon', () => {
    const text = dxfWithEntities('0\nLINE\n8\n0\n10\n0.0\n20\n0.0\n11\n1.0\n21\n0.0\n');
    const result = importDxfPolygon(text);
    expect(result.points).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
