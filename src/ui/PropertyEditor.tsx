import { useEffect, useMemo, useState } from 'react';
import { buildGrain } from '../physics/grains';
import type { PerforatedGrain } from '../physics/grains/base';
import { presetPropellants } from '../physics/presetPropellants';
import { computeGrainPreview } from '../physics/preview';
import type {
  BatesGrainProperties,
  GrainConfig,
  InhibitedEnds,
  MoonBurnerProperties,
  MotorConfigProperties,
  NozzleConfig,
  PropellantConfig,
  PropellantTab,
  StarGrainProperties,
} from '../physics/types';
import type { Selection } from './MotorBuilder';
import { GrainPreviewPanel } from './GrainPreviewPanel';
import { NumberField, SelectField } from './fields';

const inhibitedOptions: { value: InhibitedEnds; label: string }[] = [
  { value: 'Neither', label: 'Neither' },
  { value: 'Top', label: 'Top' },
  { value: 'Bottom', label: 'Bottom' },
  { value: 'Both', label: 'Both' },
];

function BatesForm({ properties, onChange }: { properties: BatesGrainProperties; onChange: (p: BatesGrainProperties) => void }) {
  return (
    <>
      <NumberField label="Diameter" isLength value={properties.diameter} onChange={(v) => onChange({ ...properties, diameter: v })} />
      <NumberField label="Length" isLength value={properties.length} onChange={(v) => onChange({ ...properties, length: v })} />
      <NumberField
        label="Core Diameter"
        isLength
        value={properties.coreDiameter}
        onChange={(v) => onChange({ ...properties, coreDiameter: v })}
      />
      <SelectField
        label="Inhibited Ends"
        value={properties.inhibitedEnds}
        options={inhibitedOptions}
        onChange={(v) => onChange({ ...properties, inhibitedEnds: v })}
      />
    </>
  );
}

function StarForm({ properties, onChange }: { properties: StarGrainProperties; onChange: (p: StarGrainProperties) => void }) {
  return (
    <>
      <NumberField label="Diameter" isLength value={properties.diameter} onChange={(v) => onChange({ ...properties, diameter: v })} />
      <NumberField label="Length" isLength value={properties.length} onChange={(v) => onChange({ ...properties, length: v })} />
      <NumberField
        label="Number of Points"
        value={properties.numPoints}
        step={1}
        min={0}
        onChange={(v) => onChange({ ...properties, numPoints: Math.round(v) })}
      />
      <NumberField
        label="Point Length"
        isLength
        value={properties.pointLength}
        onChange={(v) => onChange({ ...properties, pointLength: v })}
      />
      <NumberField
        label="Point Base Width"
        isLength
        value={properties.pointWidth}
        onChange={(v) => onChange({ ...properties, pointWidth: v })}
      />
      <SelectField
        label="Inhibited Ends"
        value={properties.inhibitedEnds}
        options={inhibitedOptions}
        onChange={(v) => onChange({ ...properties, inhibitedEnds: v })}
      />
    </>
  );
}

function MoonBurnerForm({ properties, onChange }: { properties: MoonBurnerProperties; onChange: (p: MoonBurnerProperties) => void }) {
  return (
    <>
      <NumberField label="Diameter" isLength value={properties.diameter} onChange={(v) => onChange({ ...properties, diameter: v })} />
      <NumberField label="Length" isLength value={properties.length} onChange={(v) => onChange({ ...properties, length: v })} />
      <NumberField
        label="Core Diameter"
        isLength
        value={properties.coreDiameter}
        onChange={(v) => onChange({ ...properties, coreDiameter: v })}
      />
      <NumberField
        label="Core Offset"
        isLength
        value={properties.coreOffset}
        onChange={(v) => onChange({ ...properties, coreOffset: v })}
      />
      <SelectField
        label="Inhibited Ends"
        value={properties.inhibitedEnds}
        options={inhibitedOptions}
        onChange={(v) => onChange({ ...properties, inhibitedEnds: v })}
      />
    </>
  );
}

function NozzleForm({ nozzle, onChange }: { nozzle: NozzleConfig; onChange: (n: NozzleConfig) => void }) {
  const expansion = nozzle.throat === 0 ? null : (nozzle.exit / nozzle.throat) ** 2;
  return (
    <>
      <NumberField label="Throat Diameter" isLength value={nozzle.throat} onChange={(v) => onChange({ ...nozzle, throat: v })} />
      <NumberField label="Exit Diameter" isLength value={nozzle.exit} onChange={(v) => onChange({ ...nozzle, exit: v })} />
      <NumberField label="Efficiency" value={nozzle.efficiency} onChange={(v) => onChange({ ...nozzle, efficiency: v })} />
      <NumberField label="Divergence Half Angle" unit="deg" value={nozzle.divAngle} onChange={(v) => onChange({ ...nozzle, divAngle: v })} />
      <NumberField label="Convergence Half Angle" unit="deg" value={nozzle.convAngle} onChange={(v) => onChange({ ...nozzle, convAngle: v })} />
      <NumberField label="Throat Length" isLength value={nozzle.throatLength} onChange={(v) => onChange({ ...nozzle, throatLength: v })} />
      <NumberField label="Slag Coefficient" unit="(m*Pa)/s" value={nozzle.slagCoeff} onChange={(v) => onChange({ ...nozzle, slagCoeff: v })} />
      <NumberField
        label="Erosion Coefficient"
        unit="m/(s*Pa)"
        value={nozzle.erosionCoeff}
        onChange={(v) => onChange({ ...nozzle, erosionCoeff: v })}
      />
      <div className="field-note">Expansion ratio: {expansion === null ? '-' : expansion.toFixed(3)}</div>
    </>
  );
}

function ConfigForm({ config, onChange }: { config: MotorConfigProperties; onChange: (c: MotorConfigProperties) => void }) {
  return (
    <>
      <NumberField label="Maximum Pressure" unit="Pa" value={config.maxPressure} onChange={(v) => onChange({ ...config, maxPressure: v })} />
      <NumberField
        label="Maximum Mass Flux"
        unit="kg/(m²·s)"
        value={config.maxMassFlux}
        onChange={(v) => onChange({ ...config, maxMassFlux: v })}
      />
      <NumberField
        label="Maximum Mach Number"
        value={config.maxMachNumber}
        onChange={(v) => onChange({ ...config, maxMachNumber: v })}
      />
      <NumberField
        label="Minimum Port/Throat Ratio"
        value={config.minPortThroat}
        onChange={(v) => onChange({ ...config, minPortThroat: v })}
      />
      <NumberField
        label="Flow Separation Warn %"
        value={config.flowSeparationWarnPercent}
        onChange={(v) => onChange({ ...config, flowSeparationWarnPercent: v })}
      />
      <NumberField
        label="Web Burnout Threshold"
        isLength
        value={config.burnoutWebThres}
        onChange={(v) => onChange({ ...config, burnoutWebThres: v })}
      />
      <NumberField
        label="Thrust Burnout Threshold"
        unit="%"
        value={config.burnoutThrustThres}
        onChange={(v) => onChange({ ...config, burnoutThrustThres: v })}
      />
      <NumberField label="Simulation Timestep" unit="s" value={config.timestep} onChange={(v) => onChange({ ...config, timestep: v })} />
      <NumberField label="Ambient Pressure" unit="Pa" value={config.ambPressure} onChange={(v) => onChange({ ...config, ambPressure: v })} />
      <NumberField
        label="Grain Map Dimension"
        value={config.mapDim}
        step={1}
        onChange={(v) => onChange({ ...config, mapDim: Math.round(v) })}
      />
      <NumberField
        label="Separation Pressure Ratio"
        value={config.sepPressureRatio}
        onChange={(v) => onChange({ ...config, sepPressureRatio: v })}
      />
    </>
  );
}

function emptyTab(): PropellantTab {
  return { minPressure: 0, maxPressure: 6895000, a: 1e-5, n: 0.3, k: 1.2, t: 1600, m: 25 };
}

function TabEditor({ tab, onChange, onRemove, removable }: { tab: PropellantTab; onChange: (t: PropellantTab) => void; onRemove: () => void; removable: boolean }) {
  return (
    <div className="propellant-tab-editor">
      <NumberField label="Min Pressure" unit="Pa" value={tab.minPressure} onChange={(v) => onChange({ ...tab, minPressure: v })} />
      <NumberField label="Max Pressure" unit="Pa" value={tab.maxPressure} onChange={(v) => onChange({ ...tab, maxPressure: v })} />
      <NumberField label="Burn Rate Coeff. (a)" unit="m/(s·Pa^n)" value={tab.a} onChange={(v) => onChange({ ...tab, a: v })} />
      <NumberField label="Burn Rate Exponent (n)" value={tab.n} onChange={(v) => onChange({ ...tab, n: v })} />
      <NumberField label="Specific Heat Ratio (k)" value={tab.k} onChange={(v) => onChange({ ...tab, k: v })} />
      <NumberField label="Combustion Temp (t)" unit="K" value={tab.t} onChange={(v) => onChange({ ...tab, t: v })} />
      <NumberField label="Exhaust Molar Mass (m)" unit="g/mol" value={tab.m} onChange={(v) => onChange({ ...tab, m: v })} />
      {removable && (
        <button className="remove-tab-button" onClick={onRemove}>
          Remove tab
        </button>
      )}
    </div>
  );
}

function PropellantForm({ propellant, onChange }: { propellant: PropellantConfig; onChange: (p: PropellantConfig) => void }) {
  const matchingPreset = presetPropellants.find((p) => p.name === propellant.name);

  return (
    <>
      <div className="propellant-preset-row">
        <label className="field">
          <span className="field-label">Load Preset</span>
          <select
            value=""
            onChange={(e) => {
              const preset = presetPropellants.find((p) => p.name === e.target.value);
              if (preset) onChange(JSON.parse(JSON.stringify(preset)));
            }}
          >
            <option value="" disabled>
              Choose…
            </option>
            {presetPropellants.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!matchingPreset}
          title={matchingPreset ? `Reset all values to the built-in "${propellant.name}" preset` : 'Name does not match a built-in preset'}
          onClick={() => matchingPreset && onChange(JSON.parse(JSON.stringify(matchingPreset)))}
        >
          Reset to Default
        </button>
      </div>

      <label className="field">
        <span className="field-label">Name</span>
        <input type="text" value={propellant.name} onChange={(e) => onChange({ ...propellant, name: e.target.value })} />
      </label>
      <NumberField label="Density" unit="kg/m³" value={propellant.density} onChange={(v) => onChange({ ...propellant, density: v })} />

      <h4>Burn rate tabs</h4>
      {propellant.tabs.map((tab, i) => (
        <TabEditor
          key={i}
          tab={tab}
          removable={propellant.tabs.length > 1}
          onChange={(t) => onChange({ ...propellant, tabs: propellant.tabs.map((tt, ti) => (ti === i ? t : tt)) })}
          onRemove={() => onChange({ ...propellant, tabs: propellant.tabs.filter((_, ti) => ti !== i) })}
        />
      ))}
      <button onClick={() => onChange({ ...propellant, tabs: [...propellant.tabs, emptyTab()] })}>+ Add Tab</button>
    </>
  );
}

interface Props {
  selection: Selection;
  grain: GrainConfig | null;
  nozzle: NozzleConfig;
  config: MotorConfigProperties;
  propellant: PropellantConfig | null;
  onApplyGrain: (index: number, grain: GrainConfig) => void;
  onApplyNozzle: (nozzle: NozzleConfig) => void;
  onApplyConfig: (config: MotorConfigProperties) => void;
  onApplyPropellant: (propellant: PropellantConfig) => void;
}

export function PropertyEditor({
  selection,
  grain,
  nozzle,
  config,
  propellant,
  onApplyGrain,
  onApplyNozzle,
  onApplyConfig,
  onApplyPropellant,
}: Props) {
  const selectionKey = JSON.stringify(selection);
  const [draftGrain, setDraftGrain] = useState<GrainConfig | null>(grain);
  const [draftNozzle, setDraftNozzle] = useState<NozzleConfig>(nozzle);
  const [draftConfig, setDraftConfig] = useState<MotorConfigProperties>(config);
  const [draftPropellant, setDraftPropellant] = useState<PropellantConfig | null>(propellant);

  // Reset the draft only when the SELECTION changes (a different grain, or switching between
  // grain/nozzle/config/propellant) — not on every upstream design change — so edits in progress
  // aren't clobbered until Apply or Cancel is pressed. This is the "collection editor" staging the
  // original desktop app uses.
  useEffect(() => {
    setDraftGrain(grain);
    setDraftNozzle(nozzle);
    setDraftConfig(config);
    setDraftPropellant(propellant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  const builtGrain = useMemo(() => {
    if (!draftGrain) return null;
    try {
      return buildGrain(draftGrain) as PerforatedGrain;
    } catch {
      return null;
    }
  }, [draftGrain]);

  const preview = useMemo(() => {
    if (!builtGrain) return null;
    try {
      return computeGrainPreview(builtGrain);
    } catch {
      return null;
    }
  }, [builtGrain]);

  if (!selection) {
    return <div className="property-editor empty">Select a grain, the nozzle, the propellant, or config to edit its properties.</div>;
  }

  if (selection.kind === 'nozzle') {
    return (
      <div className="property-editor">
        <h3>Nozzle</h3>
        <NozzleForm nozzle={draftNozzle} onChange={setDraftNozzle} />
        <div className="apply-cancel-row">
          <button className="primary" onClick={() => onApplyNozzle(draftNozzle)}>
            Apply
          </button>
          <button onClick={() => setDraftNozzle(nozzle)}>Cancel</button>
        </div>
      </div>
    );
  }

  if (selection.kind === 'config') {
    return (
      <div className="property-editor">
        <h3>Config</h3>
        <ConfigForm config={draftConfig} onChange={setDraftConfig} />
        <div className="apply-cancel-row">
          <button className="primary" onClick={() => onApplyConfig(draftConfig)}>
            Apply
          </button>
          <button onClick={() => setDraftConfig(config)}>Cancel</button>
        </div>
      </div>
    );
  }

  if (selection.kind === 'propellant') {
    if (!draftPropellant) {
      return (
        <div className="property-editor">
          <h3>Propellant</h3>
          <p className="field-note">No propellant selected yet — pick one to start from.</p>
          <label className="field">
            <span className="field-label">Load Preset</span>
            <select
              value=""
              onChange={(e) => {
                const preset = presetPropellants.find((p) => p.name === e.target.value);
                if (preset) setDraftPropellant(JSON.parse(JSON.stringify(preset)));
              }}
            >
              <option value="" disabled>
                Choose…
              </option>
              {presetPropellants.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      );
    }
    return (
      <div className="property-editor">
        <h3>Propellant</h3>
        <PropellantForm propellant={draftPropellant} onChange={setDraftPropellant} />
        <div className="apply-cancel-row">
          <button className="primary" onClick={() => onApplyPropellant(draftPropellant)}>
            Apply
          </button>
          <button onClick={() => setDraftPropellant(propellant)}>Cancel</button>
        </div>
      </div>
    );
  }

  if (selection.kind === 'grain' && draftGrain) {
    return (
      <div className="property-editor">
        <div className="property-editor-columns">
          <div className="property-editor-form">
            <h3>{draftGrain.type}</h3>
            {draftGrain.type === 'BATES' && (
              <BatesForm properties={draftGrain.properties} onChange={(properties) => setDraftGrain({ type: 'BATES', properties })} />
            )}
            {draftGrain.type === 'Star Grain' && (
              <StarForm properties={draftGrain.properties} onChange={(properties) => setDraftGrain({ type: 'Star Grain', properties })} />
            )}
            {draftGrain.type === 'Moon Burner' && (
              <MoonBurnerForm
                properties={draftGrain.properties}
                onChange={(properties) => setDraftGrain({ type: 'Moon Burner', properties })}
              />
            )}
            <div className="apply-cancel-row">
              <button className="primary" onClick={() => onApplyGrain(selection.index, draftGrain)}>
                Apply
              </button>
              <button onClick={() => setDraftGrain(grain)}>Cancel</button>
            </div>
          </div>
          <div className="property-editor-preview">
            <GrainPreviewPanel preview={preview} grain={builtGrain} />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
