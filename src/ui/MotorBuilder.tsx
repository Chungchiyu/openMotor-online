import { useState } from 'react';
import { defaultGrainConfig } from '../physics/grains';
import type { GrainConfig, MotorConfigProperties, MotorDesign, NozzleConfig, PropellantConfig } from '../physics/types';
import { CollectionList } from './CollectionList';
import { PropertyEditor } from './PropertyEditor';

export type Selection = { kind: 'grain'; index: number } | { kind: 'nozzle' } | { kind: 'config' } | { kind: 'propellant' } | null;

interface Props {
  design: MotorDesign;
  selection: Selection;
  onSelectionChange: (s: Selection) => void;
  onDesignChange: (updater: (design: MotorDesign) => MotorDesign) => void;
}

export function MotorBuilder({ design, selection, onSelectionChange, onDesignChange }: Props) {
  const [newGrainType, setNewGrainType] = useState<GrainConfig['type']>('BATES');

  const applyGrain = (index: number, grain: GrainConfig) => {
    onDesignChange((d) => ({ ...d, grains: d.grains.map((g, i) => (i === index ? grain : g)) }));
  };

  const applyNozzle = (nozzle: NozzleConfig) => {
    onDesignChange((d) => ({ ...d, nozzle }));
  };

  const applyConfig = (config: MotorConfigProperties) => {
    onDesignChange((d) => ({ ...d, config }));
  };

  const applyPropellant = (propellant: PropellantConfig) => {
    onDesignChange((d) => ({ ...d, propellant }));
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

  return (
    <div className="motor-builder">
      <PropertyEditor
        selection={selection}
        grain={selection?.kind === 'grain' ? design.grains[selection.index] : null}
        nozzle={design.nozzle}
        config={design.config}
        propellant={design.propellant}
        onApplyGrain={applyGrain}
        onApplyNozzle={applyNozzle}
        onApplyConfig={applyConfig}
        onApplyPropellant={applyPropellant}
      />

      <hr />

      <CollectionList
        grains={design.grains}
        propellant={design.propellant}
        selection={selection}
        onSelect={onSelectionChange}
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
        </select>
        <button onClick={addGrain}>+ Add Grain</button>
      </div>
    </div>
  );
}
