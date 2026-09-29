/**
 * Geometry helpers for turning DXF entities into plain point chunks, and stitching those chunks
 * into closed polygons — a TS translation of the geometric parts of Python's
 * `uilib/widgets/polygonEditor.py` (`loadDXF`), minus the Qt file-dialog/ezdxf plumbing (that lives
 * in dxfImport.ts, which calls the `dxf-parser` npm package for the actual DXF text parsing).
 */
import { polygonArea } from './polygonRaster';

export type Point2 = [number, number];

const CLOSE_DIST = 1e-3;

function dist(a: Point2, b: Point2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Samples an arc of `radius` centered at `center`, from `startDeg` to `endDeg` (DXF convention:
 * counterclockwise, degrees), wrapping through 360 if `endDeg < startDeg`. One point every ~3
 * degrees, matching the visual fidelity `ezdxf.path.flattening(0.01)` gives for typical grain-core-
 * sized arcs — this feeds a rasterizer, not a CAD viewer, so sub-percent chord error is plenty. */
export function flattenArc(center: { x: number; y: number }, radius: number, startDeg: number, endDeg: number): Point2[] {
  let span = endDeg - startDeg;
  if (span <= 0) span += 360;
  const steps = Math.max(2, Math.ceil(span / 3));
  const points: Point2[] = [];
  for (let i = 0; i <= steps; i++) {
    const deg = startDeg + (span * i) / steps;
    const rad = (deg * Math.PI) / 180;
    points.push([center.x + radius * Math.cos(rad), center.y + radius * Math.sin(rad)]);
  }
  return points;
}

/** Samples a (possibly elliptical-arc) DXF ELLIPSE entity. `majorAxisEndPoint` is relative to
 * `center`; `startRad`/`endRad` are parametric angles in radians (DXF's own convention), swept
 * counterclockwise, wrapping through 2*pi if `endRad < startRad`. */
export function flattenEllipse(
  center: { x: number; y: number },
  majorAxisEndPoint: { x: number; y: number },
  axisRatio: number,
  startRad: number,
  endRad: number,
): Point2[] {
  const majorLen = Math.hypot(majorAxisEndPoint.x, majorAxisEndPoint.y);
  const rotation = Math.atan2(majorAxisEndPoint.y, majorAxisEndPoint.x);
  const minorLen = majorLen * axisRatio;
  let span = endRad - startRad;
  if (span <= 0) span += 2 * Math.PI;
  const steps = Math.max(2, Math.ceil((span * 180) / Math.PI / 3));
  const points: Point2[] = [];
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  for (let i = 0; i <= steps; i++) {
    const t = startRad + (span * i) / steps;
    const ex = majorLen * Math.cos(t);
    const ey = minorLen * Math.sin(t);
    points.push([center.x + ex * cosR - ey * sinR, center.y + ex * sinR + ey * cosR]);
  }
  return points;
}

/** Flattens one LWPOLYLINE segment between two vertices, honoring a nonzero "bulge" (DXF's way of
 * encoding an arc between two polyline vertices: bulge = tan(includedAngle / 4), positive for a
 * counterclockwise arc). A zero bulge is just the straight segment. */
export function flattenBulgeSegment(a: Point2, b: Point2, bulge: number): Point2[] {
  if (bulge === 0) return [a, b];

  const chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const includedAngle = 4 * Math.atan(bulge);
  // Signed: positive bulge -> positive includedAngle -> positive radius (sin(includedAngle/2) > 0
  // throughout (0, pi)), negative bulge -> negative radius. That sign, carried through into
  // `apothem` below, is what places the center on the correct side of the chord — no separate
  // sign flip needed (one was tried and tested wrong: it cancels the sign radius already carries
  // for a negative bulge, putting the center on the wrong side).
  const radius = chord / (2 * Math.sin(includedAngle / 2));
  const midX = (a[0] + b[0]) / 2;
  const midY = (a[1] + b[1]) / 2;
  // Signed distance from the chord midpoint to the arc's center, along the chord's perpendicular.
  const apothem = radius * Math.cos(includedAngle / 2);
  const dx = (b[0] - a[0]) / chord;
  const dy = (b[1] - a[1]) / chord;
  const perpX = -dy;
  const perpY = dx;
  const centerX = midX + perpX * apothem;
  const centerY = midY + perpY * apothem;

  const startAngle = Math.atan2(a[1] - centerY, a[0] - centerX);
  const steps = Math.max(2, Math.ceil((Math.abs(includedAngle) * 180) / Math.PI / 3));
  const points: Point2[] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (includedAngle * i) / steps;
    points.push([centerX + Math.abs(radius) * Math.cos(angle), centerY + Math.abs(radius) * Math.sin(angle)]);
  }
  // Floating point: force the exact requested endpoints rather than the arc's own rounding.
  points[0] = a;
  points[points.length - 1] = b;
  return points;
}

/**
 * Evaluates a (non-rational) B-spline via De Boor's algorithm and samples it at `numSamples`
 * evenly-spaced parameter values across its valid domain. Matches the curve a DXF SPLINE entity's
 * `controlPoints`/`knotValues`/`degreeOfSplineCurve` describe (dxf-parser doesn't expose per-point
 * weights, so a spline flagged `rational` in the DXF can't be evaluated exactly here — callers
 * should treat that as unsupported, same as Python's own alert for entities it can't import).
 */
export function flattenSpline(controlPoints: Point2[], knots: number[], degree: number, numSamples: number): Point2[] {
  const n = controlPoints.length - 1;
  const domainLo = knots[degree];
  const domainHi = knots[n + 1];

  const evaluate = (u: number): Point2 => {
    // Find the knot span k such that knots[k] <= u < knots[k+1] (clamped at the domain's own end).
    let k = degree;
    while (k < n && u >= knots[k + 1]) k++;

    const d: Point2[] = [];
    for (let j = 0; j <= degree; j++) d[j] = [...controlPoints[j + k - degree]] as Point2;
    for (let r = 1; r <= degree; r++) {
      for (let j = degree; j >= r; j--) {
        const left = knots[j + k - degree];
        const right = knots[j + 1 + k - r];
        const alpha = right === left ? 0 : (u - left) / (right - left);
        d[j] = [d[j - 1][0] * (1 - alpha) + d[j][0] * alpha, d[j - 1][1] * (1 - alpha) + d[j][1] * alpha];
      }
    }
    return d[degree];
  };

  const points: Point2[] = [];
  for (let i = 0; i <= numSamples; i++) {
    const u = domainLo + ((domainHi - domainLo) * i) / numSamples;
    points.push(evaluate(u));
  }
  // Bypasses any floating-point drift in the loop's own endpoint arithmetic above.
  points[0] = evaluate(domainLo);
  points[points.length - 1] = evaluate(domainHi);
  return points;
}

/**
 * Joins open point chunks (from LINE entities, or curves that didn't already close) into closed
 * polygons wherever their endpoints coincide within `CLOSE_DIST`, mirroring
 * `polygonEditor.py::loadDXF`'s chunk-joining loop. A chunk whose own two ends already coincide
 * (e.g. a full CIRCLE) is a closed polygon on its own and doesn't need joining. Whatever's left over
 * after joining (no matching endpoint found) is reported back as `openChunks` rather than silently
 * dropped or force-closed, since an open contour can't be rasterized as a core shape.
 */
export function chunksToClosedPolygons(chunks: Point2[][]): { polygons: Point2[][]; openChunks: Point2[][] } {
  const isClosed = (c: Point2[]) => c.length >= 3 && dist(c[0], c[c.length - 1]) < CLOSE_DIST;

  const polygons: Point2[][] = [];
  let working = chunks.filter((c) => {
    if (isClosed(c)) {
      polygons.push(c);
      return false;
    }
    return true;
  });

  // Repeatedly merge any two chunks whose endpoints coincide, trying all four end-to-end
  // orientations, until no more merges are possible.
  let mergedSomething = true;
  while (mergedSomething) {
    mergedSomething = false;
    outer: for (let i = 0; i < working.length; i++) {
      for (let j = 0; j < working.length; j++) {
        if (i === j) continue;
        const a = working[i];
        const b = working[j];
        if (dist(a[a.length - 1], b[0]) < CLOSE_DIST) {
          const merged = [...a, ...b.slice(1)];
          working = working.filter((_, idx) => idx !== i && idx !== j);
          working.push(merged);
          mergedSomething = true;
          break outer;
        }
        if (dist(a[a.length - 1], b[b.length - 1]) < CLOSE_DIST) {
          const merged = [...a, ...[...b].reverse().slice(1)];
          working = working.filter((_, idx) => idx !== i && idx !== j);
          working.push(merged);
          mergedSomething = true;
          break outer;
        }
      }
    }
  }

  const openChunks: Point2[][] = [];
  for (const chunk of working) {
    if (isClosed(chunk)) polygons.push(chunk);
    else openChunks.push(chunk);
  }

  return { polygons, openChunks };
}

/** Picks the polygon with the greatest area from a non-empty list. */
export function largestPolygon(polygons: Point2[][]): Point2[] {
  return polygons.reduce((largest, p) => (polygonArea(p) > polygonArea(largest) ? p : largest));
}
