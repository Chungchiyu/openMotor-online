import { useEffect, useMemo, useState } from 'react';
import { buildGrain } from '../physics/grains';
import type { PerforatedGrain } from '../physics/grains/base';
import { computeGrainPreview } from '../physics/preview';
import {
  defaultMotorConfig,
  type BatesGrainProperties,
  type GrainConfig,
  type InhibitedEnds,
  type MoonBurnerProperties,
  type MotorConfigProperties,
  type NozzleConfig,
  type StarGrainProperties,
} from '../physics/types';
import type { Selection } from './MotorBuilder';
import { FormValidityProvider, useFormIsValid } from './FormValidityContext';
import { GrainPreviewPanel } from './GrainPreviewPanel';
import { NozzlePreview } from './NozzlePreview';
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
      <NumberField label="Diameter" unitKind="m" value={properties.diameter} onChange={(v) => onChange({ ...properties, diameter: v })} />
      <NumberField label="Length" unitKind="m" value={properties.length} onChange={(v) => onChange({ ...properties, length: v })} />
      <NumberField
        label="Core Diameter"
        unitKind="m"
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
      <NumberField label="Diameter" unitKind="m" value={properties.diameter} onChange={(v) => onChange({ ...properties, diameter: v })} />
      <NumberField label="Length" unitKind="m" value={properties.length} onChange={(v) => onChange({ ...properties, length: v })} />
      <NumberField
        label="Number of Points"
        value={properties.numPoints}
        step={1}
        min={0}
        onChange={(v) => onChange({ ...properties, numPoints: Math.round(v) })}
      />
      <NumberField
        label="Point Length"
        unitKind="m"
        value={properties.pointLength}
        onChange={(v) => onChange({ ...properties, pointLength: v })}
      />
      <NumberField
        label="Point Base Width"
        unitKind="m"
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
      <NumberField label="Diameter" unitKind="m" value={properties.diameter} onChange={(v) => onChange({ ...properties, diameter: v })} />
      <NumberField label="Length" unitKind="m" value={properties.length} onChange={(v) => onChange({ ...properties, length: v })} />
      <NumberField
        label="Core Diameter"
        unitKind="m"
        value={properties.coreDiameter}
        onChange={(v) => onChange({ ...properties, coreDiameter: v })}
      />
      <NumberField
        label="Core Offset"
        unitKind="m"
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
    <div className="property-editor-columns">
      <div className="property-editor-form">
        <NumberField label="Throat Diameter" unitKind="m" value={nozzle.throat} onChange={(v) => onChange({ ...nozzle, throat: v })} />
        <NumberField label="Exit Diameter" unitKind="m" value={nozzle.exit} onChange={(v) => onChange({ ...nozzle, exit: v })} />
        <NumberField label="Efficiency" value={nozzle.efficiency} onChange={(v) => onChange({ ...nozzle, efficiency: v })} />
        <NumberField label="Divergence Half Angle" unit="deg" value={nozzle.divAngle} onChange={(v) => onChange({ ...nozzle, divAngle: v })} />
        <NumberField label="Convergence Half Angle" unit="deg" value={nozzle.convAngle} onChange={(v) => onChange({ ...nozzle, convAngle: v })} />
        <NumberField label="Throat Length" unitKind="m" value={nozzle.throatLength} onChange={(v) => onChange({ ...nozzle, throatLength: v })} />
        <NumberField label="Slag Coefficient" unitKind="(m*Pa)/s" value={nozzle.slagCoeff} onChange={(v) => onChange({ ...nozzle, slagCoeff: v })} />
        <NumberField
          label="Erosion Coefficient"
          unitKind="m/(s*Pa)"
          value={nozzle.erosionCoeff}
          onChange={(v) => onChange({ ...nozzle, erosionCoeff: v })}
        />
        <div className="field-note">Expansion ratio: {expansion === null ? '-' : expansion.toFixed(3)}</div>
      </div>
      <div className="property-editor-preview">
        <NozzlePreview nozzle={nozzle} />
      </div>
    </div>
  );
}

function ConfigForm({ config, onChange }: { config: MotorConfigProperties; onChange: (c: MotorConfigProperties) => void }) {
  return (
    <>
      <NumberField label="Maximum Pressure" unitKind="Pa" value={config.maxPressure} onChange={(v) => onChange({ ...config, maxPressure: v })} />
      <NumberField
        label="Maximum Mass Flux"
        unitKind="kg/(m^2*s)"
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
        unitKind="m"
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
      <NumberField label="Ambient Pressure" unitKind="Pa" value={config.ambPressure} onChange={(v) => onChange({ ...config, ambPressure: v })} />
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

/** The Apply/Cancel row shared by all three property forms below — reads the enclosing
 * `FormValidityProvider` so Apply is disabled while any field in the form is empty/invalid. */
function ApplyCancelRow({ onApply, onCancel, applyLabel = 'Apply' }: { onApply: () => void; onCancel: () => void; applyLabel?: string }) {
  const isValid = useFormIsValid();
  return (
    <div className="apply-cancel-row">
      <button className="primary" onClick={onApply} disabled={!isValid} title={isValid ? undefined : 'Fix the highlighted field(s) before applying'}>
        {applyLabel}
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
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
  /** Called after Apply or Cancel, for every kind — the editor always closes back to the empty
   * state rather than staying open on whatever was just applied/discarded. */
  onClose: () => void;
}

export function PropertyEditor({ selection, grain, nozzle, config, onApplyGrain, onApplyNozzle, onApplyConfig, onClose }: Props) {
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
    return <div className="property-editor empty">Double-click a grain, nozzle, or config row to edit its properties.</div>;
  }

  if (selection.kind === 'nozzle') {
    return (
      <FormValidityProvider>
        <div className="property-editor">
          <div className="property-editor-scroll">
            <h3>Nozzle</h3>
            <NozzleForm nozzle={draftNozzle} onChange={setDraftNozzle} />
          </div>
          <ApplyCancelRow
            onApply={() => {
              onApplyNozzle(draftNozzle);
              onClose();
            }}
            onCancel={onClose}
          />
        </div>
      </FormValidityProvider>
    );
  }

  if (selection.kind === 'config') {
    return (
      <FormValidityProvider>
        <div className="property-editor">
          <div className="property-editor-scroll">
            <h3>Config</h3>
            <div className="propellant-preset-row">
              <button title="Reset all values to openMotor's built-in defaults" onClick={() => setDraftConfig(defaultMotorConfig())}>
                Reset to Default
              </button>
            </div>
            <ConfigForm config={draftConfig} onChange={setDraftConfig} />
          </div>
          <ApplyCancelRow
            onApply={() => {
              onApplyConfig(draftConfig);
              onClose();
            }}
            onCancel={onClose}
          />
        </div>
      </FormValidityProvider>
    );
  }

  if (selection.kind === 'grain' && draftGrain) {
    return (
      <FormValidityProvider>
        <div className="property-editor">
          <div className="property-editor-scroll">
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
                <ApplyCancelRow
                  onApply={() => {
                    onApplyGrain(selection.index, draftGrain);
                    onClose();
                  }}
                  onCancel={onClose}
                />
              </div>
              <div className="property-editor-preview">
                <GrainPreviewPanel preview={preview} grain={builtGrain} />
              </div>
            </div>
          </div>
        </div>
      </FormValidityProvider>
    );
  }

  return null;
}
