import { useEffect, useState } from 'react';
import type { PropellantConfig } from '../physics/types';
import { uniqueName } from '../propellantLibrary';
import { PropellantForm } from './PropellantForm';
import { usePropellantLibrary } from './PropellantLibraryContext';

interface Props {
  onClose: () => void;
}

function blankPropellant(existingNames: string[]): PropellantConfig {
  return {
    name: uniqueName(
      existingNames.map((n) => ({ name: n, density: 0, tabs: [] })),
      'New Propellant',
    ),
    density: 1700,
    tabs: [{ minPressure: 0, maxPressure: 6895000, a: 1e-5, n: 0.3, k: 1.2, t: 1600, m: 25 }],
  };
}

/**
 * A library-wide propellant manager — separate from any one motor design, matching the original
 * desktop app's dedicated "Propellant Editor" window (as opposed to editing a propellant inline as
 * part of the motor being built). Reachable from the "Propellant Editor" button next to the
 * per-motor propellant dropdown in MotorBuilder.
 */
export function PropellantEditorDialog({ onClose }: Props) {
  const { library, updatePropellant, addPropellant, deletePropellant } = usePropellantLibrary();
  const [selectedName, setSelectedName] = useState<string | null>(library[0]?.name ?? null);
  const [draft, setDraft] = useState<PropellantConfig | null>(library[0] ?? null);

  useEffect(() => {
    setDraft(library.find((p) => p.name === selectedName) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedName]);

  const handleNew = () => {
    const fresh = blankPropellant(library.map((p) => p.name));
    addPropellant(fresh);
    setSelectedName(fresh.name);
  };

  const handleDelete = () => {
    if (!selectedName || library.length <= 1) return;
    deletePropellant(selectedName);
    const remaining = library.filter((p) => p.name !== selectedName);
    setSelectedName(remaining[0]?.name ?? null);
  };

  const handleApply = () => {
    if (!selectedName || !draft) return;
    updatePropellant(selectedName, draft);
    setSelectedName(draft.name);
  };

  return (
    <div className="about-dialog-backdrop" onClick={onClose}>
      <div className="propellant-editor-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="propellant-editor-header">
          <h2>Propellant Editor</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="propellant-editor-body">
          <div className="propellant-editor-list">
            <ul>
              {library.map((p) => (
                <li key={p.name} className={p.name === selectedName ? 'selected' : ''} onClick={() => setSelectedName(p.name)}>
                  {p.name}
                </li>
              ))}
            </ul>
            <div className="propellant-editor-list-actions">
              <button onClick={handleNew}>+ New</button>
              <button onClick={handleDelete} disabled={library.length <= 1}>
                Delete
              </button>
            </div>
          </div>
          <div className="propellant-editor-form">
            {draft ? (
              <>
                <PropellantForm propellant={draft} onChange={setDraft} />
                <div className="apply-cancel-row">
                  <button className="primary" onClick={handleApply}>
                    Apply
                  </button>
                  <button onClick={() => setDraft(library.find((p) => p.name === selectedName) ?? null)}>Cancel</button>
                </div>
              </>
            ) : (
              <div className="property-editor empty">Select a propellant from the list, or create a new one.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
