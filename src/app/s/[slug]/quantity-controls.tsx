"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

/** The data has an in-stock flag but no stock counts, so this is the only per-item limit we can enforce. */
export const MAX_QTY = 99;

/** Outlined Add. Same footprint as QtyStepper (44px tall, full width of its slot) so swapping never shifts layout. */
export function AddButton({ label, onClick, disabled = false, text = "Add" }: { label: string; onClick: () => void; disabled?: boolean; text?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className="btn-outline h-11 w-full">
      {!disabled && <Plus className="h-4 w-4" aria-hidden="true" />}
      {text}
    </button>
  );
}

export function QtyStepper({
  quantity,
  name,
  onSet,
  onNotice,
  className = "w-full",
}: {
  quantity: number;
  name: string;
  /** Sets an absolute quantity. 0 removes the item. */
  onSet: (quantity: number) => void;
  onNotice: (message: string) => void;
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
      onNotice(`You can add up to ${MAX_QTY} of one item.`);
      return;
    }
    if (value !== quantity) onSet(value);
  }

  function increase() {
    if (quantity >= MAX_QTY) {
      onNotice(`You can add up to ${MAX_QTY} of one item.`);
      return;
    }
    onSet(quantity + 1);
  }

  return (
    <div
      className={`text-brand-deep bg-brand-soft flex h-11 items-center rounded-lg shadow-[inset_0_0_0_1.5px_var(--brand)] ${className}`}
      role="group"
      aria-label={`${name} quantity`}
    >
      <button type="button" className="flex h-full w-11 shrink-0 items-center justify-center rounded-l-lg" onClick={() => onSet(quantity - 1)} aria-label={quantity === 1 ? `Remove ${name}` : `One less ${name}`}>
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        enterKeyHint="done"
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
      <button type="button" className="flex h-full w-11 shrink-0 items-center justify-center rounded-r-lg" onClick={increase} aria-label={`One more ${name}`}>
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
