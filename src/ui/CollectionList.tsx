import type { GrainConfig, PropellantConfig } from '../physics/types';
import type { Selection } from './MotorBuilder';

interface Props {
  grains: GrainConfig[];
  propellant: PropellantConfig | null;
  selection: Selection;
  onSelect: (s: Selection) => void;
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
 * The unified list of everything the property editor above can edit: each grain, the propellant,
 * the nozzle, and the simulation config — mirroring the original desktop app's single "collection"
 * list (see the comparison in the design discussion). Move/copy/delete only make sense for grain
 * rows.
 */
export function CollectionList({ grains, propellant, selection, onSelect, onMoveUp, onMoveDown, onCopy, onDelete }: Props) {
  const selectedGrainIndex = selection?.kind === 'grain' ? selection.index : null;

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
            <tr key={i} className={selectedGrainIndex === i ? 'selected' : ''} onClick={() => onSelect({ kind: 'grain', index: i })}>
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
          <tr className={selection?.kind === 'propellant' ? 'selected' : ''} onClick={() => onSelect({ kind: 'propellant' })}>
            <td>—</td>
            <td>Propellant</td>
            <td>{propellant ? propellant.name : '(none selected)'}</td>
          </tr>
          <tr className={selection?.kind === 'nozzle' ? 'selected' : ''} onClick={() => onSelect({ kind: 'nozzle' })}>
            <td>—</td>
            <td>Nozzle</td>
            <td>throat/exit, angles, losses</td>
          </tr>
          <tr className={selection?.kind === 'config' ? 'selected' : ''} onClick={() => onSelect({ kind: 'config' })}>
            <td>—</td>
            <td>Config</td>
            <td>limits &amp; simulation settings</td>
          </tr>
        </tbody>
      </table>
      <div className="grain-list-actions">
        <button disabled={selectedGrainIndex === null || selectedGrainIndex === 0} onClick={() => selectedGrainIndex !== null && onMoveUp(selectedGrainIndex)}>
          ↑ Up
        </button>
        <button
          disabled={selectedGrainIndex === null || selectedGrainIndex === grains.length - 1}
          onClick={() => selectedGrainIndex !== null && onMoveDown(selectedGrainIndex)}
        >
          ↓ Down
        </button>
        <button disabled={selectedGrainIndex === null} onClick={() => selectedGrainIndex !== null && onCopy(selectedGrainIndex)}>
          Copy
        </button>
        <button disabled={selectedGrainIndex === null} onClick={() => selectedGrainIndex !== null && onDelete(selectedGrainIndex)}>
          Delete
        </button>
      </div>
    </div>
  );
}
