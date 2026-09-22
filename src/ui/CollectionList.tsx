import type { GrainConfig } from '../physics/types';
import type { Selection } from './MotorBuilder';

interface Props {
  grains: GrainConfig[];
  /** The row highlighted for Up/Down/Copy/Delete — independent of which editor is currently open
   * (see the double-click note below). */
  highlightedGrainIndex: number | null;
  /** Which editor is currently open, purely to also highlight the Nozzle/Config rows when theirs
   * is the one open. */
  selection: Selection;
  onHighlightGrain: (index: number) => void;
  onEditGrain: (index: number) => void;
  onEditNozzle: () => void;
  onEditConfig: () => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onCopy: (index: number) => void;
  onDelete: (index: number) => void;
}

function describeGrain(g: GrainConfig): string {
  const dia = `Ø${(g.properties.diameter * 1000).toFixed(1)}mm`;
  const len = `L${(g.properties.length * 1000).toFixed(0)}mm`;
  if (g.type === 'BATES') return `${dia} ${len}`;
  if (g.type === 'Star Grain') return `${g.properties.numPoints}-point ${dia} ${len}`;
  return `${dia} ${len}, offset ${(g.properties.coreOffset * 1000).toFixed(1)}mm`;
}

/**
 * The unified list of everything the property editor above can edit: each grain, the nozzle, and
 * the simulation config — mirroring the original desktop app's single "collection" list. A grain
 * row is a two-step interaction, also matching the original (which has separate Edit/Copy/Delete
 * buttons next to the list rather than opening on a single click): a single click just selects/
 * highlights the row (so Up/Down/Copy/Delete know what to act on); double-click opens it in the
 * property editor above. Nozzle and Config are singletons with no such actions, so a single click
 * opens them directly.
 */
export function CollectionList({
  grains,
  highlightedGrainIndex,
  selection,
  onHighlightGrain,
  onEditGrain,
  onEditNozzle,
  onEditConfig,
  onMoveUp,
  onMoveDown,
  onCopy,
  onDelete,
}: Props) {
  return (
    <div className="grain-list">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Type</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {grains.map((g, i) => (
            <tr
              key={i}
              className={highlightedGrainIndex === i ? 'selected' : ''}
              onClick={() => onHighlightGrain(i)}
              onDoubleClick={() => onEditGrain(i)}
            >
              <td>{i + 1}</td>
              <td>{g.type}</td>
              <td>{describeGrain(g)}</td>
            </tr>
          ))}
          {grains.length === 0 && (
            <tr>
              <td colSpan={3} className="empty-row">
                No grains yet — add one below.
              </td>
            </tr>
          )}
          <tr className={selection?.kind === 'nozzle' ? 'selected' : ''} onClick={onEditNozzle}>
            <td>—</td>
            <td>Nozzle</td>
            <td>throat/exit, angles, losses</td>
          </tr>
          <tr className={selection?.kind === 'config' ? 'selected' : ''} onClick={onEditConfig}>
            <td>—</td>
            <td>Config</td>
            <td>limits &amp; simulation settings</td>
          </tr>
        </tbody>
      </table>
      <div className="grain-list-actions">
        <button
          disabled={highlightedGrainIndex === null || highlightedGrainIndex === 0}
          onClick={() => highlightedGrainIndex !== null && onMoveUp(highlightedGrainIndex)}
        >
          ↑ Up
        </button>
        <button
          disabled={highlightedGrainIndex === null || highlightedGrainIndex === grains.length - 1}
          onClick={() => highlightedGrainIndex !== null && onMoveDown(highlightedGrainIndex)}
        >
          ↓ Down
        </button>
        <button disabled={highlightedGrainIndex === null} onClick={() => highlightedGrainIndex !== null && onEditGrain(highlightedGrainIndex)}>
          Edit
        </button>
        <button disabled={highlightedGrainIndex === null} onClick={() => highlightedGrainIndex !== null && onCopy(highlightedGrainIndex)}>
          Copy
        </button>
        <button disabled={highlightedGrainIndex === null} onClick={() => highlightedGrainIndex !== null && onDelete(highlightedGrainIndex)}>
          Delete
        </button>
      </div>
    </div>
  );
}
