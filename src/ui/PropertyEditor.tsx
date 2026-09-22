import { useEffect, useMemo, useState } from 'react';
import { buildGrain } from '../physics/grains';
import type { PerforatedGrain } from '../physics/grains/base';
import { computeGrainPreview } from '../physics/preview';
import type {
  BatesGrainProperties,
  GrainConfig,
  InhibitedEnds,
  MotorConfigProperties,
  NozzleConfig,
  StarGrainProperties,
} from '../physics/types';
import type { Selection } from './MotorBuilder';
import { GrainPreviewCanvas } from './GrainPreviewCanvas';
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

interface Props {
  selection: Selection;
  grain: GrainConfig | null;
  nozzle: NozzleConfig;
  config: MotorConfigProperties;
  onApplyGrain: (index: number, grain: GrainConfig) => void;
  onApplyNozzle: (nozzle: NozzleConfig) => void;
  onApplyConfig: (config: MotorConfigProperties) => void;
}

export function PropertyEditor({ selection, grain, nozzle, config, onApplyGrain, onApplyNozzle, onApplyConfig }: Props) {
  const selectionKey = JSON.stringify(selection);
  const [draftGrain, setDraftGrain] = useState<GrainConfig | null>(grain);
  const [draftNozzle, setDraftNozzle] = useState<NozzleConfig>(nozzle);
  const [draftConfig, setDraftConfig] = useState<MotorConfigProperties>(config);

  // Reset the draft only when the SELECTION changes (a different grain, or switching between
  // grain/nozzle/config) — not on every upstream design change — so edits in progress aren't
  // clobbered until Apply or Cancel is pressed. This is the "collection editor" staging the
  // original desktop app uses.
  useEffect(() => {
    setDraftGrain(grain);
    setDraftNozzle(nozzle);
    setDraftConfig(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  const preview = useMemo(() => {
    if (!draftGrain) return null;
    try {
      return computeGrainPreview(buildGrain(draftGrain) as PerforatedGrain);
    } catch {
      return null;
    }
  }, [draftGrain]);

  if (!selection) {
    return <div className="property-editor empty">Select a grain, the nozzle, or config to edit its properties.</div>;
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

  if (selection.kind === 'grain' && draftGrain) {
    return (
      <div className="property-editor">
        <div className="property-editor-columns">
          <div className="property-editor-form">
            <h3>{draftGrain.type}</h3>
            {draftGrain.type === 'BATES' ? (
              <BatesForm
                properties={draftGrain.properties}
                onChange={(properties) => setDraftGrain({ type: 'BATES', properties })}
              />
            ) : (
              <StarForm
                properties={draftGrain.properties}
                onChange={(properties) => setDraftGrain({ type: 'Star Grain', properties })}
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
            <GrainPreviewCanvas preview={preview} />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
