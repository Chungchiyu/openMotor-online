import type { ChangeEvent } from 'react';

interface NumberFieldProps {
  label: string;
  value: number;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

export function NumberField({ label, value, unit, step, min, max, onChange }: NumberFieldProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = Number.parseFloat(e.target.value);
    if (!Number.isNaN(next)) onChange(next);
  };
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-input">
        <input type="number" value={value} step={step ?? 'any'} min={min} max={max} onChange={handleChange} />
        {unit && <span className="field-unit">{unit}</span>}
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
