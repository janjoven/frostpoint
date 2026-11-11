import { Minus, Plus } from "@phosphor-icons/react";

/** Quantity control. Going below `min` removes the line (value 0), matching the order minimum. */
export function Stepper({ value, min, max, label, onChange }: { value: number; min: number; max: number; label: string; onChange: (v: number) => void }) {
  return (
    <div className="stepper" role="group" aria-label={`${label} quantity`}>
      <button type="button" aria-label={`Remove one ${label}`} onClick={() => onChange(value - 1 < min ? 0 : value - 1)}><Minus size={18} aria-hidden="true" /></button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label={`Add one ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}><Plus size={18} aria-hidden="true" /></button>
    </div>
  );
}
