import { useState } from 'react';
import { defaultGrainConfig } from '../physics/grains';
import type { GrainConfig, MotorConfigProperties, MotorDesign, NozzleConfig } from '../physics/types';
import { CollectionList } from './CollectionList';
import { PropellantEditorDialog } from './PropellantEditorDialog';
import { usePropellantLibrary } from './PropellantLibraryContext';
import { PropertyEditor } from './PropertyEditor';

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
  };

  const moveGrain = (index: number, dir: -1 | 1) => {
    onDesignChange((d) => {
      const grains = [...d.grains];
      const target = index + dir;
      if (target < 0 || target >= grains.length) return d;
      [grains[index], grains[target]] = [grains[target], grains[index]];
      return { ...d, grains };
    });
    setHighlightedGrainIndex(index + dir);
  };

  const copyGrain = (index: number) => {
    onDesignChange((d) => {
      const grains = [...d.grains];
      grains.splice(index + 1, 0, JSON.parse(JSON.stringify(grains[index])));
      return { ...d, grains };
    });
  };

  const deleteGrain = (index: number) => {
    onDesignChange((d) => ({ ...d, grains: d.grains.filter((_, i) => i !== index) }));
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
          <label className="field">
            <span className="field-label">Propellant</span>
            <select
              value={design.propellant?.name ?? ''}
              onChange={(e) => {
                const propellant = library.find((p) => p.name === e.target.value) ?? null;
                onDesignChange((d) => ({ ...d, propellant }));
              }}
            >
              <option value="" disabled>
                Select a propellant…
              </option>
              {library.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => setShowPropellantEditor(true)}>Propellant Editor</button>
        </div>

        <CollectionList
          grains={design.grains}
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
          onMoveUp={(i) => moveGrain(i, -1)}
          onMoveDown={(i) => moveGrain(i, 1)}
          onCopy={copyGrain}
          onDelete={deleteGrain}
        />

        <div className="add-grain-row">
          <select value={newGrainType} onChange={(e) => setNewGrainType(e.target.value as GrainConfig['type'])}>
            <option value="BATES">BATES</option>
            <option value="Star Grain">Star Grain</option>
            <option value="Moon Burner">Moon Burner</option>
            <option value="D Grain">D Grain</option>
            <option value="X Core">X Core</option>
            <option value="C Grain">C Grain</option>
            <option value="Finocyl">Finocyl</option>
            <option value="Rod and Tube">Rod and Tube</option>
            <option value="End Burner">End Burner</option>
            <option value="Conical">Conical</option>
          </select>
          <button onClick={addGrain}>+ Add Grain</button>
        </div>
      </div>

      {showPropellantEditor && <PropellantEditorDialog onClose={() => setShowPropellantEditor(false)} />}
    </div>
  );
}
