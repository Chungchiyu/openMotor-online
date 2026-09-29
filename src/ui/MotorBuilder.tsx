import { useEffect, useRef, useState } from 'react';
import { defaultGrainConfig } from '../physics/grains';
import type { GrainConfig, MotorConfigProperties, MotorDesign, NozzleConfig } from '../physics/types';
import { CollectionList } from './CollectionList';
import { PropellantEditorDialog } from './PropellantEditorDialog';
import { usePropellantLibrary } from './PropellantLibraryContext';
import { PropertyEditor } from './PropertyEditor';
import { Select } from './Select';

export type Selection = { kind: 'grain'; index: number } | { kind: 'nozzle' } | { kind: 'config' } | null;

interface Props {
  design: MotorDesign;
  selection: Selection;
  onSelectionChange: (s: Selection) => void;
  onDesignChange: (updater: (design: MotorDesign) => MotorDesign) => void;
}

export function MotorBuilder({ design, selection, onSelectionChange, onDesignChange }: Props) {
  const [newGrainType, setNewGrainType] = useState<GrainConfig['type']>('BATES');
  const [highlightedGrainIndex, setHighlightedGrainIndex] = useState<number | null>(null);
  const [highlightedKind, setHighlightedKind] = useState<'nozzle' | 'config' | null>(null);
  const [showPropellantEditor, setShowPropellantEditor] = useState(false);
  const { library } = usePropellantLibrary();

  // A stable per-grain id, independent of array position, used only as CollectionList's row `key`
  // (see reorderGrains below). Array-index keys can't survive a drag: SortableJS physically moves
  // the dragged <tr> itself, and with position-based keys React's next render treats "index 0" as
  // the same element it always was, patching the wrong physical node instead of recognizing a
  // move — a stable id is what lets React's own reconciliation correctly move (not repaint) the
  // right DOM node to match wherever SortableJS actually dropped it.
  const nextGrainId = useRef(design.grains.length);
  const [grainIds, setGrainIds] = useState<number[]>(() => design.grains.map((_, i) => i));
  // Safety net for grains changing length through something other than the handlers below (e.g. a
  // file load or undo/redo, which replace design.grains wholesale) — keeps grainIds the same
  // length as design.grains so CollectionList never indexes past the end of either array. It's a
  // no-op whenever the handlers below already kept both in sync.
  useEffect(() => {
    setGrainIds((ids) => {
      if (ids.length === design.grains.length) return ids;
      if (ids.length < design.grains.length) {
        const added = Array.from({ length: design.grains.length - ids.length }, () => nextGrainId.current++);
        return [...ids, ...added];
      }
      return ids.slice(0, design.grains.length);
    });
  }, [design.grains.length]);

  const applyGrain = (index: number, grain: GrainConfig) => {
    onDesignChange((d) => ({ ...d, grains: d.grains.map((g, i) => (i === index ? grain : g)) }));
  };

  const applyNozzle = (nozzle: NozzleConfig) => {
    onDesignChange((d) => ({ ...d, nozzle }));
  };

  const applyConfig = (config: MotorConfigProperties) => {
    onDesignChange((d) => ({ ...d, config }));
  };

  const addGrain = () => {
    onDesignChange((d) => ({ ...d, grains: [...d.grains, defaultGrainConfig(newGrainType)] }));
    setGrainIds((ids) => [...ids, nextGrainId.current++]);
  };

  // Called with the drag's raw oldIndex/newIndex (rather than an already-reordered grains array)
  // so grainIds can be permuted the exact same way, keeping each id attached to the same grain it
  // was before the drag.
  const reorderGrains = (oldIndex: number, newIndex: number) => {
    onDesignChange((d) => {
      const grains = [...d.grains];
      const [moved] = grains.splice(oldIndex, 1);
      grains.splice(newIndex, 0, moved);
      return { ...d, grains };
    });
    setGrainIds((ids) => {
      const next = [...ids];
      const [movedId] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, movedId);
      return next;
    });
    // A drag can move grains other than the highlighted/open one, so their indices are no longer
    // trustworthy afterward — same reasoning as deleteGrain resetting selection below.
    setHighlightedGrainIndex(null);
    if (selection?.kind === 'grain') onSelectionChange(null);
  };

  const copyGrain = (index: number) => {
    onDesignChange((d) => {
      const grains = [...d.grains];
      grains.splice(index + 1, 0, JSON.parse(JSON.stringify(grains[index])));
      return { ...d, grains };
    });
    setGrainIds((ids) => {
      const next = [...ids];
      next.splice(index + 1, 0, nextGrainId.current++);
      return next;
    });
  };

  const deleteGrain = (index: number) => {
    onDesignChange((d) => ({ ...d, grains: d.grains.filter((_, i) => i !== index) }));
    setGrainIds((ids) => ids.filter((_, i) => i !== index));
    // Keep the highlight on whichever grain took the deleted one's place (or the new last grain,
    // if the last one was deleted) instead of un-highlighting everything.
    const remainingCount = design.grains.length - 1;
    setHighlightedGrainIndex(remainingCount > 0 ? Math.min(index, remainingCount - 1) : null);
    onSelectionChange(null);
  };

  // "Exit" after Apply or Cancel: the editor closes back to empty rather than staying open on
  // whatever was just applied/discarded, and the list row it was editing un-highlights too.
  const closeEditor = () => {
    onSelectionChange(null);
    setHighlightedGrainIndex(null);
    setHighlightedKind(null);
  };

  return (
    <div className="motor-builder">
      <div className="motor-builder-editor">
        <PropertyEditor
          selection={selection}
          grain={selection?.kind === 'grain' ? design.grains[selection.index] : null}
          nozzle={design.nozzle}
          config={design.config}
          onApplyGrain={applyGrain}
          onApplyNozzle={applyNozzle}
          onApplyConfig={applyConfig}
          onClose={closeEditor}
        />
      </div>

      <div className="motor-builder-list">
        <hr />

        <div className="propellant-row">
          <div className="field">
            <span className="field-label">Propellant</span>
            <Select
              value={design.propellant?.name ?? ''}
              placeholder="Select a propellant…"
              options={library.map((p) => ({ value: p.name, label: p.name }))}
              ariaLabel="Propellant"
              onChange={(name) => {
                const propellant = library.find((p) => p.name === name) ?? null;
                onDesignChange((d) => ({ ...d, propellant }));
              }}
            />
          </div>
          <button onClick={() => setShowPropellantEditor(true)}>Propellant Editor</button>
        </div>

        <CollectionList
          grains={design.grains}
          grainIds={grainIds}
          highlightedGrainIndex={highlightedGrainIndex}
          highlightedKind={highlightedKind}
          onHighlightGrain={(i) => {
            setHighlightedKind(null);
            setHighlightedGrainIndex(i);
          }}
          onHighlightNozzle={() => {
            setHighlightedGrainIndex(null);
            setHighlightedKind('nozzle');
          }}
          onHighlightConfig={() => {
            setHighlightedGrainIndex(null);
            setHighlightedKind('config');
          }}
          onEditGrain={(i) => {
            setHighlightedKind(null);
            setHighlightedGrainIndex(i);
            onSelectionChange({ kind: 'grain', index: i });
          }}
          onEditNozzle={() => {
            setHighlightedGrainIndex(null);
            setHighlightedKind('nozzle');
            onSelectionChange({ kind: 'nozzle' });
          }}
          onEditConfig={() => {
            setHighlightedGrainIndex(null);
            setHighlightedKind('config');
            onSelectionChange({ kind: 'config' });
          }}
          onReorderGrains={reorderGrains}
        />

        <div className="grain-list-actions">
          <Select
            value={newGrainType}
            onChange={setNewGrainType}
            options={[
              { value: 'BATES', label: 'BATES' },
              { value: 'Star Grain', label: 'Star Grain' },
              { value: 'Moon Burner', label: 'Moon Burner' },
              { value: 'D Grain', label: 'D Grain' },
              { value: 'X Core', label: 'X Core' },
              { value: 'C Grain', label: 'C Grain' },
              { value: 'Finocyl', label: 'Finocyl' },
              { value: 'Rod and Tube', label: 'Rod and Tube' },
              { value: 'End Burner', label: 'End Burner' },
              { value: 'Conical', label: 'Conical' },
            ]}
          />
          <button className="add-grain-btn" onClick={addGrain}>
            + Add Grain
          </button>
          <button
            disabled={highlightedGrainIndex === null}
            onClick={() => highlightedGrainIndex !== null && onSelectionChange({ kind: 'grain', index: highlightedGrainIndex })}
          >
            Edit
          </button>
          <button disabled={highlightedGrainIndex === null} onClick={() => highlightedGrainIndex !== null && copyGrain(highlightedGrainIndex)}>
            Copy
          </button>
          <button disabled={highlightedGrainIndex === null} onClick={() => highlightedGrainIndex !== null && deleteGrain(highlightedGrainIndex)}>
            Delete
          </button>
        </div>
      </div>

      {showPropellantEditor && <PropellantEditorDialog onClose={() => setShowPropellantEditor(false)} />}
    </div>
  );
}
