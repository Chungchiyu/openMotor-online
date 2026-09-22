import { useState } from 'react';
import { defaultGrainConfig } from '../physics/grains';
import { presetPropellants } from '../physics/presetPropellants';
import type { GrainConfig, MotorDesign, NozzleConfig } from '../physics/types';
import { GrainList } from './GrainList';
import { PropertyEditor } from './PropertyEditor';

export type Selection = { kind: 'grain'; index: number } | { kind: 'nozzle' } | null;

interface Props {
  design: MotorDesign;
  selection: Selection;
  onSelectionChange: (s: Selection) => void;
  onDesignChange: (updater: (design: MotorDesign) => MotorDesign) => void;
}

export function MotorBuilder({ design, selection, onSelectionChange, onDesignChange }: Props) {
  const [newGrainType, setNewGrainType] = useState<GrainConfig['type']>('BATES');

  const updateGrain = (index: number, grain: GrainConfig) => {
    onDesignChange((d) => ({ ...d, grains: d.grains.map((g, i) => (i === index ? grain : g)) }));
  };

  const updateNozzle = (nozzle: NozzleConfig) => {
    onDesignChange((d) => ({ ...d, nozzle }));
  };

  const addGrain = () => {
    onDesignChange((d) => ({ ...d, grains: [...d.grains, defaultGrainConfig(newGrainType)] }));
    onSelectionChange({ kind: 'grain', index: design.grains.length });
  };

  const moveGrain = (index: number, dir: -1 | 1) => {
    onDesignChange((d) => {
      const grains = [...d.grains];
      const target = index + dir;
      if (target < 0 || target >= grains.length) return d;
      [grains[index], grains[target]] = [grains[target], grains[index]];
      return { ...d, grains };
    });
    onSelectionChange({ kind: 'grain', index: index + dir });
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
    onSelectionChange(null);
  };

  const selectedIndex = selection?.kind === 'grain' ? selection.index : null;

  return (
    <div className="motor-builder">
      <PropertyEditor
        {...(selection?.kind === 'grain'
          ? { kind: 'grain' as const, grain: design.grains[selection.index], onGrainChange: (g: GrainConfig) => updateGrain(selection.index, g) }
          : selection?.kind === 'nozzle'
            ? { kind: 'nozzle' as const, nozzle: design.nozzle, onNozzleChange: updateNozzle }
            : { kind: 'none' as const })}
      />

      <hr />

      <div className="propellant-row">
        <label className="field">
          <span className="field-label">Propellant</span>
          <select
            value={design.propellant?.name ?? ''}
            onChange={(e) => {
              const propellant = presetPropellants.find((p) => p.name === e.target.value) ?? null;
              onDesignChange((d) => ({ ...d, propellant }));
            }}
          >
            <option value="" disabled>
              Select a propellant…
            </option>
            {presetPropellants.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button className={selection?.kind === 'nozzle' ? 'active' : ''} onClick={() => onSelectionChange({ kind: 'nozzle' })}>
          Edit Nozzle
        </button>
      </div>

      <GrainList
        grains={design.grains}
        selectedIndex={selectedIndex}
        onSelect={(i) => onSelectionChange({ kind: 'grain', index: i })}
        onMoveUp={(i) => moveGrain(i, -1)}
        onMoveDown={(i) => moveGrain(i, 1)}
        onCopy={copyGrain}
        onDelete={deleteGrain}
      />

      <div className="add-grain-row">
        <select value={newGrainType} onChange={(e) => setNewGrainType(e.target.value as GrainConfig['type'])}>
          <option value="BATES">BATES</option>
          <option value="Star Grain">Star Grain</option>
        </select>
        <button onClick={addGrain}>+ Add Grain</button>
      </div>
    </div>
  );
}
