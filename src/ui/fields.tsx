import type { ReactNode } from 'react';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset><legend>{title}</legend>{children}</fieldset>;
}

interface NumberProps {
  label: string; unit: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}

/** A number input that always shows its unit inside the field. */
export function NumberField({ label, unit, value, onChange, min, max, step = 1 }: NumberProps) {
  return (
    <label>
      {label}
      <span className="u" data-u={unit}>
        <input type="number" value={Number.isFinite(value) ? value : ''} min={min} max={max} step={step}
          onChange={(e) => { const v = e.target.valueAsNumber; if (Number.isFinite(v)) onChange(v); }} />
      </span>
    </label>
  );
}

export function RangeField({ label, value, onChange, min, max, step = 1, action }: Omit<NumberProps, 'unit'> & { action?: ReactNode }) {
  return (
    <label className="range">
      <span>{label} <output>{value}</output></span>
      <span className="range-row">
        <input type="range" value={value} min={min} max={max} step={step} onChange={(e) => onChange(e.target.valueAsNumber)} />
        {action}
      </span>
    </label>
  );
}

export function SelectField<T extends string | number>({ label, value, options, onChange }: {
  label: string; value: T; options: [T, string][]; onChange: (v: T) => void;
}) {
  return (
    <label>
      {label}
      <select value={String(value)} onChange={(e) => onChange(options.find(([v]) => String(v) === e.target.value)![0])}>
        {options.map(([v, text]) => <option key={String(v)} value={String(v)}>{text}</option>)}
      </select>
    </label>
  );
}

export function CheckField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}
