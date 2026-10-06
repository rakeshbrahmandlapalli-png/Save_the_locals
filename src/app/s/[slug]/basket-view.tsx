"use client";

import { ArrowLeft, ArrowRight, Bike, ShoppingBasket, Store, Trash2 } from "lucide-react";
import { ProductRow, ShelfHeader } from "./product-card";
import { ProductImage } from "./product-image";
import { QtyStepper } from "./quantity-controls";
import { formatMoney, plural, useStore } from "./store-context";

export function countLine(productCount: number, units: number) {
  return productCount === units ? plural(units, "item", "items") : `${plural(productCount, "product", "products")} · ${plural(units, "unit", "units")}`;
}

export function FulfilmentSwitch() {
  const { shop, fulfilment, setFulfilment } = useStore();
  const options = [
    { value: "delivery" as const, label: "Delivery", note: shop.delivery_fee > 0 ? `₹${formatMoney(shop.delivery_fee)}` : "Free", Icon: Bike },
    { value: "pickup" as const, label: "Pickup", note: "Free", Icon: Store },
  ];
  return (
    <div className="grid grid-cols-2 gap-1 rounded-[var(--radius)] border border-[var(--line-strong)] bg-white p-1" role="radiogroup" aria-label="Delivery or pickup">
      {options.map(({ value, label, note, Icon }) => {
        const active = fulfilment === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setFulfilment(value)}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-2 text-sm font-semibold ${active ? "bg-brand-deep text-white" : "text-[var(--ink)]"}`}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            {label}
            <span className={`font-normal ${active ? "text-white/80" : "text-[var(--ink-soft)]"}`}>· {note}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Bill({ title = "Bill" }: { title?: string }) {
  const { subtotal, deliveryCharge, total, fulfilment, productCount, units } = useStore();
  return (
    <section aria-label="Bill details" className="surface bill-summary p-4">
      <h2 className="text-sm font-bold">{title}</h2>
      <dl className="mt-2 space-y-1.5 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-[var(--ink-soft)]">{countLine(productCount, units).replace(/^./, (letter) => letter.toUpperCase())}</dt><dd>₹{formatMoney(subtotal)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-[var(--ink-soft)]">{fulfilment === "delivery" ? "Delivery" : "Pickup"}</dt><dd>{deliveryCharge > 0 ? `₹${formatMoney(deliveryCharge)}` : "Free"}</dd></div>
      </dl>
      <div className="receipt-rule mt-3 flex justify-between pt-3 text-base font-bold"><span>Total</span><span>₹{formatMoney(total)}</span></div>
      <p className="mt-1 text-xs text-[var(--ink-soft)]">Prices are final. You pay when the order reaches you.</p>
    </section>
  );
}

export function BasketView({ depth }: { depth: number }) {
  const { basketProducts, products, quantities, setQuantity, notify, back, goHome, open, productCount, units, remaining, total, shop, aisleOf, typing } = useStore();

  // Suggestions: in stock, not already in the basket, from the same aisles first.
  const basketAisles = new Set(basketProducts.map((product) => product.category_id));
  const candidates = products.filter((product) => product.in_stock && !(quantities[product.id] > 0));
  const suggestions = [...candidates.filter((product) => basketAisles.has(product.category_id)), ...candidates.filter((product) => !basketAisles.has(product.category_id))].slice(0, 1);

  return (
    <div className="animate-sheet fixed inset-0 overflow-y-auto overscroll-contain bg-[var(--ivory)]" style={{ zIndex: 50 + depth }} role="dialog" aria-modal="true" aria-labelledby="basket-heading">
      <div className="mx-auto max-w-2xl px-4 pb-[calc(8.5rem+env(safe-area-inset-bottom))] sm:px-6">
        <div className="flex items-center gap-1 py-2">
          <button type="button" onClick={back} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-md" aria-label="Back to shopping"><ArrowLeft className="h-6 w-6" aria-hidden="true" /></button>
          <div>
            <h1 id="basket-heading" className="text-lg font-bold leading-6">Your basket</h1>
            {units > 0 && <p className="text-xs text-[var(--ink-soft)]">{countLine(productCount, units)}</p>}
          </div>
        </div>

        {basketProducts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <ShoppingBasket className="h-10 w-10 text-[var(--ink-soft)] [stroke-width:1.5]" aria-hidden="true" />
            <p className="text-lg font-bold">Your basket is empty</p>
            <p className="text-sm text-[var(--ink-soft)]">Add a few things and they’ll show up here.</p>
            <button type="button" onClick={goHome} className="btn-primary mt-2">Start shopping</button>
          </div>
        ) : (
          <div className="space-y-5">
            <FulfilmentSwitch />

            <ul className="surface divide-y divide-[var(--line-strong)] px-3" aria-label="Items in your basket">
              {basketProducts.map((product) => {
                const quantity = quantities[product.id] ?? 0;
                const aisle = aisleOf(product);
                return (
                  <li key={product.id} className="flex gap-3 py-3">
                    <ProductImage src={product.image_url} alt="" accent={aisle?.accent} icon={aisle?.icon ?? null} className="h-14 w-14 shrink-0 rounded-md" iconClassName="h-6 w-6" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="line-clamp-2 break-words text-sm font-semibold leading-5">{product.name}</h2>
                          <p className="text-xs text-[var(--ink-soft)]">{product.unit} · ₹{formatMoney(product.price)} each</p>
                        </div>
                        <p className="shrink-0 text-sm font-bold leading-5">₹{formatMoney(product.price * quantity)}</p>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <QtyStepper quantity={quantity} name={product.name} onSet={(next) => setQuantity(product.id, next)} onNotice={notify} className="w-32" />
                        <button type="button" onClick={() => setQuantity(product.id, 0)} className="-mr-2 flex h-11 w-11 items-center justify-center rounded-md text-[var(--ink-soft)]" aria-label={`Remove ${product.name} from basket`}>
                          <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {suggestions.length > 0 && (
              <section aria-labelledby="suggest-heading">
                <ShelfHeader id="suggest-heading" title="You might also need" />
                <ul className="surface mt-3 divide-y divide-[var(--line)] px-3">
                  {suggestions.map((product) => <ProductRow key={product.id} product={product} />)}
                </ul>
              </section>
            )}

            <Bill />
          </div>
        )}
      </div>

      {basketProducts.length > 0 && !typing && (
        <div className="fixed inset-x-0 bottom-0 border-t border-[var(--line)] bg-[var(--ivory)] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3" style={{ zIndex: 51 + depth }}>
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            {remaining > 0 && (
              <p className="mb-2 text-center text-xs font-semibold text-amber-900">Add ₹{formatMoney(remaining)} more to reach the ₹{formatMoney(shop.min_order)} minimum.</p>
            )}
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-[var(--ink-soft)]">Total</p>
                <p className="text-xl font-bold leading-6">₹{formatMoney(total)}</p>
              </div>
              <button type="button" disabled={remaining > 0} onClick={() => open({ kind: "checkout" })} className="btn-primary flex-1 text-base">
                Checkout <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
