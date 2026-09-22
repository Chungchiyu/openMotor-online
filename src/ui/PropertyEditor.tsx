import { useMemo } from 'react';
import { buildGrain } from '../physics/grains';
import type { PerforatedGrain } from '../physics/grains/base';
import { computeGrainPreview } from '../physics/preview';
import type { BatesGrainProperties, GrainConfig, InhibitedEnds, NozzleConfig, StarGrainProperties } from '../physics/types';
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
      <NumberField label="Diameter" unit="m" value={properties.diameter} onChange={(v) => onChange({ ...properties, diameter: v })} />
      <NumberField label="Length" unit="m" value={properties.length} onChange={(v) => onChange({ ...properties, length: v })} />
      <NumberField
        label="Core Diameter"
        unit="m"
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
      <NumberField label="Diameter" unit="m" value={properties.diameter} onChange={(v) => onChange({ ...properties, diameter: v })} />
      <NumberField label="Length" unit="m" value={properties.length} onChange={(v) => onChange({ ...properties, length: v })} />
      <NumberField
        label="Number of Points"
        value={properties.numPoints}
        step={1}
        min={0}
        onChange={(v) => onChange({ ...properties, numPoints: Math.round(v) })}
      />
      <NumberField
        label="Point Length"
        unit="m"
        value={properties.pointLength}
        onChange={(v) => onChange({ ...properties, pointLength: v })}
      />
      <NumberField
        label="Point Base Width"
        unit="m"
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
      <NumberField label="Throat Diameter" unit="m" value={nozzle.throat} onChange={(v) => onChange({ ...nozzle, throat: v })} />
      <NumberField label="Exit Diameter" unit="m" value={nozzle.exit} onChange={(v) => onChange({ ...nozzle, exit: v })} />
      <NumberField label="Efficiency" value={nozzle.efficiency} onChange={(v) => onChange({ ...nozzle, efficiency: v })} />
      <NumberField
        label="Divergence Half Angle"
        unit="deg"
        value={nozzle.divAngle}
        onChange={(v) => onChange({ ...nozzle, divAngle: v })}
      />
      <NumberField
        label="Convergence Half Angle"
        unit="deg"
        value={nozzle.convAngle}
        onChange={(v) => onChange({ ...nozzle, convAngle: v })}
      />
      <NumberField
        label="Throat Length"
        unit="m"
        value={nozzle.throatLength}
        onChange={(v) => onChange({ ...nozzle, throatLength: v })}
      />
      <div className="field-note">Expansion ratio: {expansion === null ? '-' : expansion.toFixed(3)}</div>
    </>
  );
}

type Props =
  | { kind: 'grain'; grain: GrainConfig; onGrainChange: (g: GrainConfig) => void }
  | { kind: 'nozzle'; nozzle: NozzleConfig; onNozzleChange: (n: NozzleConfig) => void }
  | { kind: 'none' };

export function PropertyEditor(props: Props) {
  const preview = useMemo(() => {
    if (props.kind !== 'grain') return null;
    const grain = buildGrain(props.grain) as PerforatedGrain;
    try {
      return computeGrainPreview(grain);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.kind === 'grain' ? JSON.stringify(props.grain) : null]);

  if (props.kind === 'none') {
    return <div className="property-editor empty">Select a grain or the nozzle to edit its properties.</div>;
  }

  if (props.kind === 'nozzle') {
    return (
      <div className="property-editor">
        <h3>Nozzle</h3>
        <NozzleForm nozzle={props.nozzle} onChange={props.onNozzleChange} />
      </div>
    );
  }

  return (
    <div className="property-editor">
      <div className="property-editor-columns">
        <div className="property-editor-form">
          <h3>{props.grain.type}</h3>
          {props.grain.type === 'BATES' ? (
            <BatesForm properties={props.grain.properties} onChange={(properties) => props.onGrainChange({ type: 'BATES', properties })} />
          ) : (
            <StarForm
              properties={props.grain.properties}
              onChange={(properties) => props.onGrainChange({ type: 'Star Grain', properties })}
            />
          )}
        </div>
        <div className="property-editor-preview">
          <GrainPreviewCanvas preview={preview} />
        </div>
      </div>
    </div>
  );
}
