import { useEffect, useRef } from 'react';
import Sortable from 'sortablejs';
import type { GrainConfig } from '../physics/types';

interface Props {
  grains: GrainConfig[];
  /** Stable per-grain identity, parallel to `grains` (same length/order) — see the comment on row
   * `key` below for why this can't just be the array index. */
  grainIds: number[];
  /** The row highlighted for Edit/Copy/Delete — independent of which editor is currently open
   * (see the double-click note below). */
  highlightedGrainIndex: number | null;
  /** Which of the singleton rows (Nozzle/Config) is highlighted — the same role
   * `highlightedGrainIndex` plays for grain rows. */
  highlightedKind: 'nozzle' | 'config' | null;
  onHighlightGrain: (index: number) => void;
  onHighlightNozzle: () => void;
  onHighlightConfig: () => void;
  onEditGrain: (index: number) => void;
  onEditNozzle: () => void;
  onEditConfig: () => void;
  onReorderGrains: (oldIndex: number, newIndex: number) => void;
}

function describeGrain(g: GrainConfig): string {
  const dia = `Ø${(g.properties.diameter * 1000).toFixed(1)}mm`;
  const len = `L${(g.properties.length * 1000).toFixed(0)}mm`;
  if (g.type === 'BATES') return `${dia} ${len}`;
  if (g.type === 'Star Grain') return `${g.properties.numPoints}-point ${dia} ${len}`;
  if (g.type === 'D Grain') return `${dia} ${len}, slot offset ${(g.properties.slotOffset * 1000).toFixed(1)}mm`;
  if (g.type === 'X Core') return `${dia} ${len}, slot ${(g.properties.slotWidth * 1000).toFixed(1)}x${(g.properties.slotLength * 1000).toFixed(1)}mm`;
  if (g.type === 'C Grain') return `${dia} ${len}, slot width ${(g.properties.slotWidth * 1000).toFixed(1)}mm`;
  if (g.type === 'Finocyl') return `${g.properties.numFins}-fin ${dia} ${len}`;
  if (g.type === 'Rod and Tube') return `${dia} ${len}, rod ${(g.properties.rodDiameter * 1000).toFixed(1)}mm`;
  if (g.type === 'End Burner') return `${dia} ${len}`;
  if (g.type === 'Conical') {
    return `${dia} ${len}, core ${(g.properties.forwardCoreDiameter * 1000).toFixed(1)}-${(g.properties.aftCoreDiameter * 1000).toFixed(1)}mm`;
  }
  return `${dia} ${len}, offset ${(g.properties.coreOffset * 1000).toFixed(1)}mm`;
}

/**
 * The unified list of everything the property editor above can edit: each grain, the nozzle, and
 * the simulation config — mirroring the original desktop app's single "collection" list. Every
 * grain row is a two-step interaction, also matching the original (which has separate Edit/Copy/
 * Delete buttons next to the list rather than opening on a single click): a single click just
 * selects/highlights the row (so Edit/Copy/Delete know what to act on), double-click opens it in
 * the property editor above. Reordering is drag-and-drop on the row itself (no separate handle),
 * since it doesn't need a "which row" selection step the way Edit/Copy/Delete do — SortableJS
 * only engages once the pointer actually moves, so a plain click/double-click still passes through.
 */
export function CollectionList({
  grains,
  grainIds,
  highlightedGrainIndex,
  highlightedKind,
  onHighlightGrain,
  onHighlightNozzle,
  onHighlightConfig,
  onEditGrain,
  onEditNozzle,
  onEditConfig,
  onReorderGrains,
}: Props) {
  const grainTbodyRef = useRef<HTMLTableSectionElement>(null);
  // Kept in a ref (not state/closure) so the onEnd handler below — installed once and never
  // recreated — always calls whatever the latest `onReorderGrains` is.
  const onReorderGrainsRef = useRef(onReorderGrains);
  useEffect(() => {
    onReorderGrainsRef.current = onReorderGrains;
  });

  useEffect(() => {
    const el = grainTbodyRef.current;
    if (!el) return;
    // Plain SortableJS driving a ref directly: it physically moves the dragged <tr> during the
    // drag, which React's reconciler never sees happen. That's fine specifically *because* each
    // row below is keyed by `grainIds[i]` (a stable per-grain id) rather than its index — when
    // onReorderGrains's state update causes a re-render, React's keyed-list diffing recognizes
    // "the fiber for this id is now at a different position" and *moves* that same DOM node
    // (matching where SortableJS already physically put it) instead of either patching content
    // onto the wrong node or needing to destroy/recreate anything. An index-based key can't do
    // this: every render it re-labels whatever grain is at position N as "id N", so React sees no
    // identity change across a reorder and never moves anything — it was that mismatch, not this
    // drag itself, that produced the earlier scrambled numbering.
    const sortable = Sortable.create(el, {
      animation: 150,
      // SortableJS defaults to the native HTML5 drag-and-drop API, which some browsers skip the
      // `animation` easing for since the browser (not SortableJS) owns the drag ghost. Forcing its
      // own mouse/touch-based fallback is what actually gets the requested drag animation.
      forceFallback: true,
      onEnd: (evt) => {
        const { oldIndex, newIndex } = evt;
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
        onReorderGrainsRef.current(oldIndex, newIndex);
      },
    });
    return () => sortable.destroy();
  }, []);

  return (
    <div className="grain-list">
      <div className="grain-list-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody ref={grainTbodyRef}>
            {grains.map((g, i) => (
              <tr
                key={grainIds[i]}
                className={`grain-row${highlightedGrainIndex === i ? ' selected' : ''}`}
                title="Click to select, double-click to edit, drag to reorder"
                onClick={() => onHighlightGrain(i)}
                onDoubleClick={() => onEditGrain(i)}
              >
                <td>{i + 1}</td>
                <td>{g.type}</td>
                <td>{describeGrain(g)}</td>
              </tr>
            ))}
          </tbody>
          <tbody>
            {grains.length === 0 && (
              <tr>
                <td colSpan={3} className="empty-row">
                  No grains yet — add one below.
                </td>
              </tr>
            )}
            <tr className={highlightedKind === 'nozzle' ? 'selected' : ''} onClick={onHighlightNozzle} onDoubleClick={onEditNozzle}>
              <td>—</td>
              <td>Nozzle</td>
              <td>throat/exit, angles, losses</td>
            </tr>
            <tr className={highlightedKind === 'config' ? 'selected' : ''} onClick={onHighlightConfig} onDoubleClick={onEditConfig}>
              <td>—</td>
              <td>Config</td>
              <td>limits &amp; simulation settings</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
