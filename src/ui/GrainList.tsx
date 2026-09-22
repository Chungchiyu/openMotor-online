import type { GrainConfig } from '../physics/types';

interface Props {
  grains: GrainConfig[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onCopy: (index: number) => void;
  onDelete: (index: number) => void;
}

function describeGrain(g: GrainConfig): string {
  if (g.type === 'BATES') return `Ø${(g.properties.diameter * 1000).toFixed(1)}mm L${(g.properties.length * 1000).toFixed(0)}mm`;
  return `${g.properties.numPoints}-point Ø${(g.properties.diameter * 1000).toFixed(1)}mm L${(g.properties.length * 1000).toFixed(0)}mm`;
}

export function GrainList({ grains, selectedIndex, onSelect, onMoveUp, onMoveDown, onCopy, onDelete }: Props) {
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
            <tr key={i} className={i === selectedIndex ? 'selected' : ''} onClick={() => onSelect(i)}>
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
        </tbody>
      </table>
      <div className="grain-list-actions">
        <button disabled={selectedIndex === null || selectedIndex === 0} onClick={() => selectedIndex !== null && onMoveUp(selectedIndex)}>
          ↑ Up
        </button>
        <button
          disabled={selectedIndex === null || selectedIndex === grains.length - 1}
          onClick={() => selectedIndex !== null && onMoveDown(selectedIndex)}
        >
          ↓ Down
        </button>
        <button disabled={selectedIndex === null} onClick={() => selectedIndex !== null && onCopy(selectedIndex)}>
          Copy
        </button>
        <button disabled={selectedIndex === null} onClick={() => selectedIndex !== null && onDelete(selectedIndex)}>
          Delete
        </button>
      </div>
    </div>
  );
}
