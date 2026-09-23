import { useState } from 'react';
import { Motor } from '../physics/motor';
import type { ToolDef } from '../physics/tools';
import type { MotorDesign } from '../physics/types';
import { FormValidityProvider, useFormIsValid } from './FormValidityContext';
import { NumberField } from './fields';

interface Props {
  tool: ToolDef;
  design: MotorDesign;
  onApply: (next: MotorDesign) => void;
  onClose: () => void;
}

/** One modal per tool: description, its inputs, and an Apply that (for tools with
 * `needsSimulation`) runs a simulation on the current design first — mirroring uilib/tool.py's
 * `Tool.applyPressed`, which does the same before calling `applyChanges`. */
export function ToolDialog({ tool, design, onApply, onClose }: Props) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(tool.inputs.map((i) => [i.key, i.default])),
  );
  const [error, setError] = useState<string | null>(null);

  const handleApply = () => {
    setError(null);
    try {
      let sim = null;
      if (tool.needsSimulation) {
        sim = new Motor(design).runSimulation();
        if (!sim.success) {
          setError('Simulation failed for the current design — fix any alerts before using this tool.');
          return;
        }
      }
      const next = tool.apply(design, values, sim);
      onApply(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tool failed to apply.');
    }
  };

  return (
    <div className="about-dialog-backdrop" onClick={onClose}>
      <div className="tool-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="propellant-editor-header">
          <h2>{tool.name}</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <FormValidityProvider>
          <div className="tool-dialog-body">
            <p className="field-note">{tool.description}</p>
            {tool.needsSimulation && <p className="field-note">This tool runs a simulation of the current design first.</p>}
            {tool.inputs.map((input) => (
              <NumberField
                key={input.key}
                label={input.label}
                unitKind={input.unitKind}
                unit={input.unit}
                value={values[input.key]}
                onChange={(v) => setValues((prev) => ({ ...prev, [input.key]: v }))}
              />
            ))}
            {error && <div className="error-banner">{error}</div>}
            <ToolApplyCancelRow onApply={handleApply} onCancel={onClose} />
          </div>
        </FormValidityProvider>
      </div>
    </div>
  );
}

function ToolApplyCancelRow({ onApply, onCancel }: { onApply: () => void; onCancel: () => void }) {
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
