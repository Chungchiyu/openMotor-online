/**
 * DXF -> single closed core polygon, for Custom Grain's "Import DXF…" button. Uses the `dxf-parser`
 * npm package for the low-level DXF text parsing (entity group codes etc.) — Python's original
 * (uilib/widgets/polygonEditor.py) instead used `ezdxf` — then re-implements the same entity
 * flattening and chunk-joining logic ezdxf/polygonEditor.py did, in dxfFlatten.ts.
 */
import DxfParser from 'dxf-parser';
import type { IArcEntity, ICircleEntity, IEllipseEntity, ILineEntity, ILwpolylineEntity, ISplineEntity } from 'dxf-parser';
import { chunksToClosedPolygons, flattenArc, flattenBulgeSegment, flattenEllipse, flattenSpline, largestPolygon, type Point2 } from './dxfFlatten';

export interface DxfImportResult {
  /** null if no usable closed polygon was found at all. */
  points: Point2[] | null;
  errors: string[];
}

const SPLINE_SAMPLES = 100;

export function importDxfPolygon(text: string): DxfImportResult {
  const parser = new DxfParser();
  let dxf;
  try {
    dxf = parser.parseSync(text);
  } catch (e) {
    return { points: null, errors: [`Failed to parse DXF file: ${(e as Error).message}`] };
  }
  if (!dxf || !dxf.entities || dxf.entities.length === 0) {
    return { points: null, errors: ['DXF file has no entities'] };
  }

  const errors: string[] = [];
  const chunks: Point2[][] = [];

  for (const entity of dxf.entities) {
    switch (entity.type) {
      case 'LINE': {
        const e = entity as ILineEntity;
        chunks.push([
          [e.vertices[0].x, e.vertices[0].y],
          [e.vertices[1].x, e.vertices[1].y],
        ]);
        break;
      }
      case 'LWPOLYLINE': {
        const e = entity as ILwpolylineEntity;
        const verts = e.vertices;
        if (verts.length < 2) break;
        const chunk: Point2[] = [[verts[0].x, verts[0].y]];
        const addSegment = (a: (typeof verts)[number], b: (typeof verts)[number]) => {
          const seg = flattenBulgeSegment([a.x, a.y], [b.x, b.y], a.bulge ?? 0);
          chunk.push(...seg.slice(1));
        };
        for (let i = 0; i < verts.length - 1; i++) addSegment(verts[i], verts[i + 1]);
        // dxf-parser doesn't add the closing segment itself for a polyline whose "closed" bit
        // (group 70, bit 1) is set — do that here so a closed LWPOLYLINE is one ready-made chunk.
        if (e.shape) addSegment(verts[verts.length - 1], verts[0]);
        chunks.push(chunk);
        break;
      }
      case 'CIRCLE': {
        const e = entity as ICircleEntity;
        chunks.push(flattenArc(e.center, e.radius, 0, 360));
        break;
      }
      case 'ARC': {
        const e = entity as IArcEntity;
        chunks.push(flattenArc(e.center, e.radius, e.startAngle, e.endAngle));
        break;
      }
      case 'ELLIPSE': {
        const e = entity as IEllipseEntity;
        chunks.push(flattenEllipse(e.center, e.majorAxisEndPoint, e.axisRatio, e.startAngle, e.endAngle));
        break;
      }
      case 'SPLINE': {
        const e = entity as ISplineEntity;
        if (e.rational) {
          errors.push('Skipped a rational SPLINE entity (weighted control points are not supported)');
          break;
        }
        if (!e.controlPoints || e.controlPoints.length === 0 || !e.knotValues) {
          errors.push('Skipped a SPLINE entity with no usable control points');
          break;
        }
        const controlPoints: Point2[] = e.controlPoints.map((p) => [p.x, p.y]);
        chunks.push(flattenSpline(controlPoints, e.knotValues, e.degreeOfSplineCurve, SPLINE_SAMPLES));
        break;
      }
      default:
        errors.push(`Skipped unsupported entity type: ${entity.type}`);
    }
  }

  const { polygons, openChunks } = chunksToClosedPolygons(chunks);
  if (openChunks.length > 0) {
    errors.push(`${openChunks.length} open contour(s) could not be closed and were skipped`);
  }
  if (polygons.length === 0) {
    return { points: null, errors: [...errors, 'No closed polygon found in the DXF file'] };
  }
  if (polygons.length > 1) {
    errors.push(`Found ${polygons.length} separate closed contours — only the largest was kept`);
  }
  return { points: largestPolygon(polygons), errors };
}
