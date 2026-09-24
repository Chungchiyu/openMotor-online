import { useEffect, useRef, useState } from 'react';
import type { PropellantConfig } from '../physics/types';
import { downloadTextFile } from '../persistence';
import { uniqueName } from '../propellantLibrary';
import { exportPropellantsRic, importPropellantsRic } from '../ric';
import { FormValidityProvider, useFormIsValid } from './FormValidityContext';
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

function PropellantApplyCancelRow({ onApply, onCancel }: { onApply: () => void; onCancel: () => void }) {
  const isValid = useFormIsValid();
  return (
    <div className="apply-cancel-row">
      <button className="primary" onClick={onApply} disabled={!isValid} title={isValid ? undefined : 'Fix the highlighted field(s) before applying'}>
        Apply
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}

/**
 * A library-wide propellant manager — separate from any one motor design, matching the original
 * desktop app's dedicated "Propellant Editor" window (as opposed to editing a propellant inline as
 * part of the motor being built). Reachable from the "Propellant Editor" button next to the
 * per-motor propellant dropdown in MotorBuilder.
 */
export function PropellantEditorDialog({ onClose }: Props) {
  const { library, updatePropellant, addPropellant, addPropellants, deletePropellant } = usePropellantLibrary();
  const [selectedName, setSelectedName] = useState<string | null>(library[0]?.name ?? null);
  const [draft, setDraft] = useState<PropellantConfig | null>(library[0] ?? null);
  const [error, setError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

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
    const index = library.findIndex((p) => p.name === selectedName);
    deletePropellant(selectedName);
    const remaining = library.filter((p) => p.name !== selectedName);
    // Keep focus on whichever propellant took the deleted one's place in the list (or the new
    // last item, if the last one was deleted) rather than always jumping back to the first entry.
    const nextIndex = Math.min(index, remaining.length - 1);
    setSelectedName(remaining[nextIndex]?.name ?? null);
  };

  const handleApply = () => {
    if (!selectedName || !draft) return;
    updatePropellant(selectedName, draft);
    setSelectedName(draft.name);
  };

  const handleExportLibrary = () => {
    downloadTextFile(exportPropellantsRic(library), 'propellants.ric', 'application/x-yaml');
  };

  const handleImportLibraryClick = () => importInputRef.current?.click();

  const handleImportLibraryFile = async (file: File) => {
    try {
      const text = await file.text();
      const imported = importPropellantsRic(text);
      // Matches the Python source's own migration-backfill pattern (add if the name is new, leave
      // existing entries alone) — re-importing a file you already have shouldn't pile up "(2)"
      // duplicates of everything in it.
      const existingNames = new Set(library.map((p) => p.name));
      const toAdd = imported.filter((p) => !existingNames.has(p.name));
      addPropellants(toAdd);
      const skipped = imported.length - toAdd.length;
      setError(skipped > 0 ? `Imported ${toAdd.length} new propellant(s); skipped ${skipped} already in your library.` : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that .ric file.');
    }
  };

  return (
    <div className="about-dialog-backdrop" onClick={onClose}>
      <div className="propellant-editor-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="propellant-editor-header">
          <h2>Propellant Editor</h2>
          <button onClick={onClose}>Close</button>
        </div>
        {error && <div className="error-banner">{error}</div>}
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
            <div className="propellant-editor-list-actions">
              <button onClick={handleImportLibraryClick}>Import .ric…</button>
              <button onClick={handleExportLibrary}>Export .ric</button>
              <input
                ref={importInputRef}
                type="file"
                accept=".ric"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportLibraryFile(file);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
          <div className="propellant-editor-form">
            {draft ? (
              <FormValidityProvider>
                <PropellantForm propellant={draft} onChange={setDraft} />
                <PropellantApplyCancelRow onApply={handleApply} onCancel={() => setDraft(library.find((p) => p.name === selectedName) ?? null)} />
              </FormValidityProvider>
            ) : (
              <div className="property-editor empty">Select a propellant from the list, or create a new one.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
