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
  /** The value in canonical (SI) units — always meters for a length field. */
  value: number;
  /** Marks this as a length field, so it's displayed/edited in the shared length unit preference
   * (see UnitsContext) instead of raw meters. Omit for non-length quantities (angles, ratios…). */
  isLength?: boolean;
  /** A fixed unit label for non-length fields (e.g. 'deg'). Ignored when `isLength` is set. */
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

export function NumberField({ label, value, isLength, unit, step, min, max, onChange }: NumberFieldProps) {
  const { lengthUnit } = useUnits();
  const displayUnit = isLength ? lengthUnit : unit;
  const displayValue = isLength ? convert(value, 'm', lengthUnit) : value;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const typed = Number.parseFloat(e.target.value);
    if (Number.isNaN(typed)) return;
    const canonical = isLength ? convert(typed, lengthUnit, 'm') : typed;
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
