import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { convert } from '../physics/units';
import { useFieldValidity } from './FormValidityContext';
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

  // The input is backed by its own text buffer, not bound directly to `displayValue` — otherwise
  // it's impossible to ever show an empty box (a live-typed "" would immediately be coerced back
  // to a number and rendered as one). `lastCommitted` records the last (value, unit) pair *we*
  // pushed upstream via onChange, so the sync effect below only overwrites the user's in-progress
  // text when the value changed for some OTHER reason (a draft reset, an undo, a unit switch) —
  // not as an echo of the keystroke that just caused it.
  const [text, setText] = useState(() => String(roundForDisplay(displayValue)));
  const lastCommitted = useRef({ value, unit: displayUnit });

  useEffect(() => {
    if (lastCommitted.current.value !== value || lastCommitted.current.unit !== displayUnit) {
      setText(String(roundForDisplay(displayValue)));
      lastCommitted.current = { value, unit: displayUnit };
    }
  }, [value, displayUnit, displayValue]);

  const isInvalid = Number.isNaN(Number.parseFloat(text));
  const fieldId = useId();
  useFieldValidity(fieldId, !isInvalid);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    const typed = e.target.valueAsNumber;
    if (Number.isNaN(typed)) return; // Empty, or not (yet) a complete number — leave the upstream value alone.
    const canonical = unitKind ? convert(typed, displayUnit!, unitKind) : typed;
    lastCommitted.current = { value: canonical, unit: displayUnit };
    onChange(canonical);
  };

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-input">
        <input
          type="number"
          className={isInvalid ? 'invalid' : undefined}
          value={text}
          step={step ?? 'any'}
          min={min}
          max={max}
          onChange={handleChange}
        />
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

interface CheckboxFieldProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function CheckboxField({ label, value, onChange }: CheckboxFieldProps) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
