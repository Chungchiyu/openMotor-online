import { findPreset } from '../propellantLibrary';
import type { PropellantConfig, PropellantTab } from '../physics/types';
import { NumberField } from './fields';
import { PropellantBurnRateGraph } from './PropellantBurnRateGraph';

function emptyTab(): PropellantTab {
  return { minPressure: 0, maxPressure: 6895000, a: 1e-5, n: 0.3, k: 1.2, t: 1600, m: 25 };
}

function TabEditor({
  tab,
  onChange,
  onRemove,
  removable,
}: {
  tab: PropellantTab;
  onChange: (t: PropellantTab) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  return (
    <div className="propellant-tab-editor">
      <NumberField label="Min Pressure" unitKind="Pa" value={tab.minPressure} onChange={(v) => onChange({ ...tab, minPressure: v })} />
      <NumberField label="Max Pressure" unitKind="Pa" value={tab.maxPressure} onChange={(v) => onChange({ ...tab, maxPressure: v })} />
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

/** The propellant property form: name, density, and its burn-rate tabs (add/remove for
 * multi-tab propellants), plus a Reset to Default that only lights up when the name matches a
 * built-in preset. Used inside PropellantEditorDialog — propellant editing lives there, as its own
 * library-wide editor, not inline in the per-motor collection list (see the design discussion). */
export function PropellantForm({ propellant, onChange }: { propellant: PropellantConfig; onChange: (p: PropellantConfig) => void }) {
  const matchingPreset = findPreset(propellant.name);

  return (
    <>
      <div className="propellant-preset-row">
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
      <NumberField label="Density" unitKind="kg/m^3" value={propellant.density} onChange={(v) => onChange({ ...propellant, density: v })} />

      <h4>Burn rate vs. pressure</h4>
      <PropellantBurnRateGraph propellant={propellant} />

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
