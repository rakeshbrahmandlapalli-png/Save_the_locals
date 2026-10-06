"use client";

import { ProductImage } from "./product-image";
import { AddButton, QtyStepper } from "./quantity-controls";
import { formatMoney, useStore } from "./store-context";
import type { Product } from "./page";

/** Add, or the stepper once the item is in the basket. Both occupy exactly the same box. */
export function ProductControl({ product }: { product: Product }) {
  const { quantities, setQuantity, notify } = useStore();
  const quantity = quantities[product.id] ?? 0;
  if (!product.in_stock) return <AddButton label={`${product.name} is out of stock`} onClick={() => {}} disabled text="Out of stock" />;
  if (quantity === 0) return <AddButton label={`Add ${product.name}`} onClick={() => setQuantity(product.id, 1)} />;
  return <QtyStepper quantity={quantity} name={product.name} onSet={(next) => setQuantity(product.id, next)} onNotice={notify} />;
}

function useImageProps(product: Product) {
  const { aisleOf } = useStore();
  const aisle = aisleOf(product);
  return { src: product.image_url, alt: product.name, accent: aisle?.accent ?? "sage", icon: aisle?.icon ?? null };
}

/** Grid card: white surface, fixed 4:3 image, two-line name slot, pack size and price together. */
export function ProductCard({ product }: { product: Product }) {
  const image = useImageProps(product);
  return (
    <article className="surface flex min-w-0 flex-col p-2">
      <ProductImage {...image} className={`aspect-[4/3] rounded-md ${product.in_stock ? "" : "opacity-55"}`} />
      <div className="flex flex-1 flex-col px-1 pt-2">
        <h3 className="line-clamp-2 min-h-10 break-words text-sm font-medium leading-5">{product.name}</h3>
        <p className="mt-1 flex items-baseline justify-between gap-2">
          <span className="text-[15px] font-bold leading-5">₹{formatMoney(product.price)}</span>
          <span className="truncate text-xs text-[var(--ink-soft)]">{product.unit}</span>
        </p>
        <div className="mt-2">
          <ProductControl product={product} />
        </div>
      </div>
    </article>
  );
}

/** Narrow card for horizontal shelves (Buy again, collections). */
export function ProductMini({ product }: { product: Product }) {
  const image = useImageProps(product);
  return (
    <article className="surface flex w-[9.25rem] shrink-0 snap-start flex-col p-2">
      <ProductImage {...image} className={`aspect-[4/3] rounded-md ${product.in_stock ? "" : "opacity-55"}`} iconClassName="h-7 w-7" />
      <h3 className="mt-2 line-clamp-2 min-h-10 break-words px-0.5 text-[13px] font-medium leading-5">{product.name}</h3>
      <p className="mt-0.5 flex items-baseline justify-between gap-1 px-0.5">
        <span className="text-sm font-bold">₹{formatMoney(product.price)}</span>
        <span className="truncate text-[11px] text-[var(--ink-soft)]">{product.unit}</span>
      </p>
      <div className="mt-2">
        <ProductControl product={product} />
      </div>
    </article>
  );
}

/** Dense list row: used for the "Under ₹50" list and basket suggestions. */
export function ProductRow({ product }: { product: Product }) {
  const image = useImageProps(product);
  return (
    <li className="flex items-center gap-3 py-2.5">
      <ProductImage {...image} className="h-14 w-14 shrink-0 rounded-md" iconClassName="h-6 w-6" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 break-words text-sm font-medium leading-5">{product.name}</p>
        <p className="text-xs text-[var(--ink-soft)]">
          {product.unit} · <span className="font-semibold text-[var(--ink)]">₹{formatMoney(product.price)}</span>
        </p>
      </div>
      <div className="w-[7.5rem] shrink-0">
        <ProductControl product={product} />
      </div>
    </li>
  );
}

/** Section heading in the shelf-label style, with an optional action on the right. */
export function ShelfHeader({ title, accent, action, id }: { title: string; accent?: string; action?: React.ReactNode; id?: string }) {
  return (
    <div className={`shelf-head ${accent ? `accent-${accent}` : ""}`}>
      <h2 id={id} className="shelf-tag">{title}</h2>
      <span className="shelf-rule" aria-hidden="true" />
      {action}
    </div>
  );
}

export function ShelfAction({ onClick, children, label }: { onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="text-brand-deep -my-2 -mr-2 flex min-h-11 shrink-0 items-center px-2 text-sm font-semibold">
      {children}
    </button>
  );
}
