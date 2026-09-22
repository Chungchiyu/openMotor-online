import type { ChangeEvent } from 'react';
import { convert } from '../physics/units';
import { useUnits } from './UnitsContext';

function roundForDisplay(value: number): number {
  // Strips floating-point conversion noise (e.g. 74.99999999999999) without mangling values the
  // user actually typed.
  return Number(value.toFixed(9));
}

interface NumberFieldProps {
  label: string;
  /** The value in canonical (SI) units. */
  value: number;
  /** The canonical (SI) unit this quantity is stored in, e.g. 'm', 'Pa', 'kg/m^3' — matches
   * motorlib/units.py's unitLabels keys. The field is displayed/edited in whichever unit the user
   * has picked for that quantity (see UnitsContext/quantityTypes), converting on the way in and
   * out. Omit for quantities with no conversion table (angles, dimensionless ratios, percentages)
   * and pass a fixed `unit` label instead. */
  unitKind?: string;
  /** A fixed unit label shown for quantities with no conversion table. Ignored when `unitKind` is set. */
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

export function NumberField({ label, value, unitKind, unit, step, min, max, onChange }: NumberFieldProps) {
  const { unitFor } = useUnits();
  const displayUnit = unitKind ? unitFor(unitKind) : unit;
  const displayValue = unitKind ? convert(value, unitKind, displayUnit!) : value;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const typed = Number.parseFloat(e.target.value);
    if (Number.isNaN(typed)) return;
    const canonical = unitKind ? convert(typed, displayUnit!, unitKind) : typed;
    onChange(canonical);
  };

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-input">
        <input type="number" value={roundForDisplay(displayValue)} step={step ?? 'any'} min={min} max={max} onChange={handleChange} />
        {displayUnit && <span className="field-unit">{displayUnit}</span>}
      </span>
    </label>
  );
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function SelectField<T extends string>({ label, value, options, onChange }: SelectFieldProps<T>) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
