import { useId, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { importDxfPolygon } from '../physics/dxfImport';
import { convert } from '../physics/units';
import { useFieldValidity } from './FormValidityContext';
import { useUnits } from './UnitsContext';

type Point = [number, number];

interface Props {
  /** Polygon vertices, in meters — same representation as CustomGrainProperties.points. */
  points: Point[];
  /** The grain's outer diameter (meters), used to size the reference circle so the drawing stays
   * intuitively scaled to the case bore the core sits inside. */
  diameter: number;
  onChange: (points: Point[]) => void;
}

const VIEW_HALF = 1.15;
const VERTEX_RADIUS = 0.028;

/**
 * The Custom Grain's core-shape editor: an interactive canvas for drawing a polygon by hand (click
 * empty space to append a point, drag existing points, right-click to delete one) plus a synced
 * coordinate table for precise entry, and a DXF import button for bringing in a CAD-drawn shape.
 * Both input paths feed the same `points` array, so an imported shape can be hand-tweaked
 * afterward and vice versa — see the design note in dxfImport.ts/dxfFlatten.ts for the DXF side.
 */
export function PolygonEditor({ points, diameter, onChange }: Props) {
  const { unitFor } = useUnits();
  const lengthUnit = unitFor('m');
  const radius = diameter / 2 || 1;
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [importMessages, setImportMessages] = useState<string[]>([]);
  const fieldId = useId();
  useFieldValidity(fieldId, points.length >= 3);

  const toView = ([x, y]: Point): [number, number] => [x / radius, -y / radius];
  const fromView = (vx: number, vy: number): Point => [vx * radius, -vy * radius];

  const clientToView = (e: { clientX: number; clientY: number }): [number, number] => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const rect = svg.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * (2 * VIEW_HALF) - VIEW_HALF;
    const vy = ((e.clientY - rect.top) / rect.height) * (2 * VIEW_HALF) - VIEW_HALF;
    return [vx, vy];
  };

  const handleBackgroundClick = (e: ReactPointerEvent<SVGSVGElement>) => {
    const [vx, vy] = clientToView(e);
    onChange([...points, fromView(vx, vy)]);
  };

  const handleVertexPointerDown = (index: number, e: ReactPointerEvent<SVGCircleElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragIndex(index);
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (dragIndex === null) return;
    const [vx, vy] = clientToView(e);
    const next = [...points];
    next[dragIndex] = fromView(vx, vy);
    onChange(next);
  };

  const stopDragging = () => setDragIndex(null);

  const handleDeleteVertex = (index: number, e: ReactMouseEvent<SVGCircleElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(points.filter((_, i) => i !== index));
  };

  const updatePointField = (index: number, axis: 0 | 1, displayValue: number) => {
    const canonical = convert(displayValue, lengthUnit, 'm');
    const next = points.map((p, i) => (i === index ? ([axis === 0 ? canonical : p[0], axis === 1 ? canonical : p[1]] as Point) : p));
    onChange(next);
  };

  const addTableRow = () => onChange([...points, [0, 0]]);
  const removeTableRow = (index: number) => onChange(points.filter((_, i) => i !== index));

  const handleDxfFile = async (file: File) => {
    const text = await file.text();
    const result = importDxfPolygon(text);
    if (result.points) onChange(result.points);
    setImportMessages(result.points ? result.errors : [...result.errors, 'Could not import a usable shape from this file.']);
  };

  return (
    <div className="polygon-editor">
      <div className="polygon-editor-canvas-wrap">
        <svg
          ref={svgRef}
          viewBox={`${-VIEW_HALF} ${-VIEW_HALF} ${2 * VIEW_HALF} ${2 * VIEW_HALF}`}
          className="polygon-editor-canvas"
          onClick={handleBackgroundClick}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerLeave={stopDragging}
        >
          <circle cx={0} cy={0} r={1} className="polygon-editor-bore" />
          {points.length >= 2 && (
            <polygon points={points.map((p) => toView(p).join(',')).join(' ')} className="polygon-editor-shape" />
          )}
          {points.map((p, i) => {
            const [vx, vy] = toView(p);
            return (
              <circle
                key={i}
                cx={vx}
                cy={vy}
                r={VERTEX_RADIUS}
                className="polygon-editor-vertex"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => handleVertexPointerDown(i, e)}
                onContextMenu={(e) => handleDeleteVertex(i, e)}
              >
                <title>Drag to move, right-click to delete</title>
              </circle>
            );
          })}
        </svg>
        <p className="polygon-editor-hint">Click to add a point, drag to move one, right-click to delete one.</p>
      </div>

      <div className="polygon-editor-side">
        <div className="polygon-editor-toolbar">
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            Import DXF…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".dxf,.DXF"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleDxfFile(file);
              e.target.value = '';
            }}
          />
        </div>
        {importMessages.length > 0 && (
          <ul className="polygon-editor-messages">
            {importMessages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}
        <table className="polygon-editor-table">
          <thead>
            <tr>
              <th>X ({lengthUnit})</th>
              <th>Y ({lengthUnit})</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <td>
                  <input
                    type="number"
                    value={roundForDisplay(convert(p[0], 'm', lengthUnit))}
                    onChange={(e) => {
                      const v = e.target.valueAsNumber;
                      if (!Number.isNaN(v)) updatePointField(i, 0, v);
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={roundForDisplay(convert(p[1], 'm', lengthUnit))}
                    onChange={(e) => {
                      const v = e.target.valueAsNumber;
                      if (!Number.isNaN(v)) updatePointField(i, 1, v);
                    }}
                  />
                </td>
                <td>
                  <button type="button" onClick={() => removeTableRow(i)} aria-label={`Remove point ${i + 1}`}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={addTableRow}>
          + Add Point
        </button>
        {points.length < 3 && <p className="polygon-editor-warning">Needs at least 3 points.</p>}
      </div>
    </div>
  );
}

function roundForDisplay(value: number): number {
  return Number(value.toFixed(6));
}
