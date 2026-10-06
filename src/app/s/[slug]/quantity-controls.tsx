"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

/** The data has an in-stock flag but no stock counts, so this is the only per-item limit we can enforce. */
export const MAX_QTY = 99;

/** Same footprint as QtyStepper (h-11, full width of its slot) so switching never shifts the layout. */
export function AddButton({ label, onClick, disabled = false, text = "Add" }: { label: string; onClick: () => void; disabled?: boolean; text?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="bg-brand-deep h-11 w-full rounded-lg px-3 text-sm font-semibold text-white disabled:bg-stone-200 disabled:text-stone-500"
    >
      {text}
    </button>
  );
}

export function QtyStepper({
  quantity,
  name,
  onSet,
  onNotice,
  removeLabel,
  className = "w-full",
}: {
  quantity: number;
  name: string;
  /** Sets an absolute quantity. 0 removes the item. */
  onSet: (quantity: number) => void;
  onNotice: (message: string) => void;
  removeLabel: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit(raw: string) {
    setDraft(null);
    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value) || value < 1) {
      onNotice(`Enter a quantity from 1 to ${MAX_QTY}, or remove the item.`);
      return;
    }
    if (value > MAX_QTY) {
      onSet(MAX_QTY);
      onNotice(`Maximum ${MAX_QTY} per item.`);
      return;
    }
    if (value !== quantity) onSet(value);
  }

  function increase() {
    if (quantity >= MAX_QTY) {
      onNotice(`Maximum ${MAX_QTY} per item.`);
      return;
    }
    onSet(quantity + 1);
  }

  return (
    <div className={`text-brand-deep flex h-11 items-center rounded-lg bg-white shadow-[inset_0_0_0_1.5px_var(--brand)] ${className}`} role="group" aria-label={`${name} quantity`}>
      <button type="button" className="flex h-full w-11 shrink-0 items-center justify-center" onClick={() => onSet(quantity - 1)} aria-label={`${removeLabel} ${name}`}>
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-label={`${name} quantity, type to edit`}
        value={draft ?? String(quantity)}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, 3))}
        onBlur={() => draft !== null && commit(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setDraft(null);
        }}
        className="min-w-0 flex-1 bg-transparent text-center text-base font-bold text-[var(--ink)] outline-none"
      />
      <button type="button" className="flex h-full w-11 shrink-0 items-center justify-center" onClick={increase} aria-label={`Add one ${name}`}>
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
