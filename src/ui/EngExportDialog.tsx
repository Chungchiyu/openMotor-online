import { useState } from 'react';
import type { EngSettings } from '../exporters/eng';
import { NumberField } from './fields';

interface Props {
  defaultDesignation: string;
  onExport: (settings: EngSettings) => void;
  onClose: () => void;
}

/** Collects the handful of values a .eng file needs that aren't already part of the simulation
 * result (case diameter/length, hardware mass, manufacturer) — matches EngExporter_ui's dialog. */
export function EngExportDialog({ defaultDesignation, onExport, onClose }: Props) {
  const [settings, setSettings] = useState({
    designation: defaultDesignation,
    diameter: 0.029,
    length: 0.1,
    hardwareMass: 0.02,
    manufacturer: '',
  });

  return (
    <div className="about-dialog-backdrop" onClick={onClose}>
      <div className="tool-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="propellant-editor-header">
          <h2>Export .eng File</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="tool-dialog-body">
          <label className="field">
            <span className="field-label">Designation</span>
            <input type="text" value={settings.designation} onChange={(e) => setSettings((s) => ({ ...s, designation: e.target.value }))} />
          </label>
          <NumberField label="Motor Diameter" unitKind="m" value={settings.diameter} onChange={(v) => setSettings((s) => ({ ...s, diameter: v }))} />
          <NumberField label="Motor Length" unitKind="m" value={settings.length} onChange={(v) => setSettings((s) => ({ ...s, length: v }))} />
          <NumberField
            label="Hardware Mass"
            unitKind="kg"
            value={settings.hardwareMass}
            onChange={(v) => setSettings((s) => ({ ...s, hardwareMass: v }))}
          />
          <label className="field">
            <span className="field-label">Manufacturer</span>
            <input type="text" value={settings.manufacturer} onChange={(e) => setSettings((s) => ({ ...s, manufacturer: e.target.value }))} />
          </label>
          <div className="apply-cancel-row">
            <button className="primary" onClick={() => onExport(settings)}>
              Export
            </button>
            <button onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
