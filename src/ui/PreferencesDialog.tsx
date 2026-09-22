import { quantityTypes, useUnits } from './UnitsContext';

interface Props {
  onClose: () => void;
}

/** Lets the user pick a display unit for every physical quantity (not just length) — matching the
 * original desktop app's Preferences dialog (uilib/preferencesManager.py: one EnumProperty per
 * motorlib/units.py `unitLabels` entry). Reachable from Edit > Preferences. */
export function PreferencesDialog({ onClose }: Props) {
  const { prefs, setUnit } = useUnits();

  return (
    <div className="about-dialog-backdrop" onClick={onClose}>
      <div className="preferences-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="propellant-editor-header">
          <h2>Preferences</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="preferences-body">
          {quantityTypes().map(({ canonical, label, options }) => (
            <label className="field" key={canonical}>
              <span className="field-label">{label}</span>
              <select value={prefs[canonical] ?? canonical} onChange={(e) => setUnit(canonical, e.target.value)}>
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
