"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { copy, type Language } from "@/lib/copy";
import { createPublicClient } from "@/lib/supabase";
import type { Category, Product, Shop } from "./page";

type Quantities = Record<string, number>;

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
}

function displayName(item: { name: string; name_local: string | null }, language: Language) {
  if (language === "te" && item.name_local) return item.name_local;
  return item.name;
}

export function Storefront({
  shop,
  categories,
  products,
  initialSource,
}: {
  shop: Shop;
  categories: Category[];
  products: Product[];
  initialSource: string | null;
}) {
  const [language, setLanguage] = useState<Language>("en");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [quantities, setQuantities] = useState<Quantities>({});
  const [source, setSource] = useState("direct");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderCode, setOrderCode] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", fulfilment: "delivery", address: "", payment: "cod", notes: "" });
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const t = copy[language];

  useEffect(() => {
    const storageKey = `stl-source:${shop.slug}`;
    const incoming = initialSource;
    if (incoming) {
      sessionStorage.setItem(storageKey, incoming);
      setSource(incoming);
    } else {
      setSource(sessionStorage.getItem(storageKey) || "direct");
    }
  }, [initialSource, shop.slug]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const inCategory = categoryId === "all" || product.category_id === categoryId;
      const searchable = `${product.name} ${product.name_local ?? ""} ${product.unit}`.toLocaleLowerCase();
      return inCategory && searchable.includes(deferredQuery);
    });
  }, [products, categoryId, deferredQuery]);

  const itemCount = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
  const total = products.reduce((sum, product) => sum + product.price * (quantities[product.id] ?? 0), 0);
  const remaining = Math.max(0, shop.min_order - total);
  const brandColour = shop.brand?.primary_colour || "#285943";

  function changeQuantity(productId: string, delta: number) {
    setQuantities((current) => {
      const next = Math.max(0, (current[productId] ?? 0) + delta);
      if (next === 0) {
        const { [productId]: _removed, ...rest } = current;
        void _removed;
        return rest;
      }
      return { ...current, [productId]: next };
    });
  }

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    const supabase = createPublicClient();
    const items = Object.entries(quantities).map(([product_id, qty]) => ({ product_id, qty }));
    const { data, error } = await supabase.rpc("place_order", {
      shop_slug: shop.slug,
      items,
      customer: { name: form.name, phone: form.phone, notes: form.notes },
      fulfilment: form.fulfilment,
      address: form.fulfilment === "delivery" ? form.address : "",
      payment_method: form.payment,
      source,
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    setOrderCode(data as string);
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-white pb-36 text-slate-950" data-order-source={source}>
      <header className="border-b border-slate-200 px-4 pb-5 pt-6" style={{ borderTop: `5px solid ${brandColour}` }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t.deliveryArea}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{displayName(shop, language)}</h1>
            {shop.name_local && (
              <p className="mt-1 text-sm text-slate-600">{language === "en" ? shop.name_local : shop.name}</p>
            )}
            {shop.address && <p className="mt-2 text-sm text-slate-500">{shop.address}</p>}
          </div>
          <button
            type="button"
            onClick={() => setLanguage((current) => (current === "en" ? "te" : "en"))}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
          >
            {t.language}
          </button>
        </div>
      </header>

      <section className="sticky top-0 z-10 bg-white/95 px-4 pb-3 pt-4 backdrop-blur-sm">
        <label className="sr-only" htmlFor="product-search">{t.searchPlaceholder}</label>
        <input
          id="product-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
        />
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Product categories">
          <CategoryButton active={categoryId === "all"} onClick={() => setCategoryId("all")} label={t.allCategories} />
          {categories.map((category) => (
            <CategoryButton
              key={category.id}
              active={categoryId === category.id}
              onClick={() => setCategoryId(category.id)}
              label={displayName(category, language)}
            />
          ))}
        </div>
      </section>

      <section className="px-4 pt-2">
        {filteredProducts.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">{t.emptySearch}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filteredProducts.map((product) => {
              const quantity = quantities[product.id] ?? 0;
              return (
                <article key={product.id} className="flex min-h-48 flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="mb-3 flex aspect-[4/3] items-center justify-center rounded-xl bg-slate-100 text-2xl font-bold text-slate-400" aria-hidden="true">
                    {product.name.slice(0, 1)}
                  </div>
                  <h2 className="text-sm font-bold leading-snug">{displayName(product, language)}</h2>
                  {product.name_local && (
                    <p className="mt-0.5 text-xs leading-snug text-slate-500">{language === "en" ? product.name_local : product.name}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">{product.unit}</p>
                  <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                    <p className="text-base font-bold">₹{formatMoney(product.price)}</p>
                    {!product.in_stock ? (
                      <span className="text-xs font-semibold text-slate-500">Out of stock</span>
                    ) : quantity === 0 ? (
                      <button
                        type="button"
                        onClick={() => changeQuantity(product.id, 1)}
                        className="rounded-lg border px-3 py-1.5 text-sm font-bold"
                        style={{ borderColor: brandColour, color: brandColour }}
                        aria-label={`${t.add} ${product.name}`}
                      >
                        {t.add}
                      </button>
                    ) : (
                      <div className="flex items-center rounded-lg border border-slate-300" aria-label={`${product.name} quantity`}>
                        <button type="button" className="h-8 w-8 text-lg" onClick={() => changeQuantity(product.id, -1)} aria-label={`${t.removeOne} ${product.name}`}>−</button>
                        <span className="min-w-7 text-center text-sm font-bold" aria-live="polite">{quantity}</span>
                        <button type="button" className="h-8 w-8 text-lg" onClick={() => changeQuantity(product.id, 1)} aria-label={`${t.addOne} ${product.name}`}>+</button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {itemCount > 0 && (
        <aside className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-2xl border-t border-slate-200 bg-white p-4 shadow-[0_-8px_24px_rgba(15,23,42,0.1)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">{itemCount} {itemCount === 1 ? t.item : t.items}</p>
              <p className="text-2xl font-bold">₹{formatMoney(total)}</p>
            </div>
            <button type="button" onClick={() => setCheckoutOpen(true)} disabled={remaining > 0} className="rounded-xl px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45" style={{ backgroundColor: brandColour }}>
              {t.openBasket}
            </button>
          </div>
          <p className={`mt-2 text-xs font-semibold ${remaining > 0 ? "text-amber-700" : "text-emerald-700"}`}>
            {remaining > 0 ? t.minimumRemaining(formatMoney(remaining)) : t.minimumReached}
          </p>
        </aside>
      )}

      {checkoutOpen && (
        <div className="fixed inset-0 z-30 overflow-y-auto bg-slate-950/50 px-3 py-5" role="dialog" aria-modal="true" aria-label="Checkout">
          <section className="mx-auto max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            {orderCode ? (
              <div className="py-8 text-center">
                <p className="text-sm font-semibold text-emerald-700">{t.orderPlaced}</p>
                <h2 className="mt-2 text-2xl font-bold">{t.orderCode}</h2>
                <p className="mt-4 text-4xl font-black tracking-[0.18em]">{orderCode}</p>
                <p className="mt-3 text-sm text-slate-600">{t.keepCode}</p>
                <a href={`/s/${shop.slug}/status?code=${orderCode}`} className="mt-6 inline-block rounded-xl px-5 py-3 font-bold text-white" style={{ backgroundColor: brandColour }}>{t.checkStatus}</a>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4">
                  <div><p className="text-sm text-slate-500">{itemCount} {t.items}</p><h2 className="text-2xl font-bold">{t.checkout}</h2></div>
                  <button type="button" onClick={() => setCheckoutOpen(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">{t.close}</button>
                </div>
                <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm">
                  <div className="flex justify-between"><span>Items</span><strong>₹{formatMoney(total)}</strong></div>
                  <div className="mt-2 flex justify-between"><span>{t.delivery}</span><strong>{form.fulfilment === "delivery" ? `₹${formatMoney(shop.delivery_fee)}` : t.free}</strong></div>
                  <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-base"><span>{t.total}</span><strong>₹{formatMoney(total + (form.fulfilment === "delivery" ? shop.delivery_fee : 0))}</strong></div>
                </div>
                <form onSubmit={submitOrder} className="mt-5 space-y-4">
                  <Field label={t.name}><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" autoComplete="name" /></Field>
                  <Field label={t.mobile}><input required inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" placeholder={t.phoneHint} autoComplete="tel" /></Field>
                  <fieldset><legend className="mb-2 text-sm font-bold">{t.fulfilmentQuestion}</legend><div className="grid grid-cols-2 gap-2"><Choice label={t.delivery} checked={form.fulfilment === "delivery"} onChange={() => setForm({ ...form, fulfilment: "delivery" })} /><Choice label={t.pickup} checked={form.fulfilment === "pickup"} onChange={() => setForm({ ...form, fulfilment: "pickup" })} /></div></fieldset>
                  {form.fulfilment === "delivery" && <Field label={t.address}><textarea required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input min-h-20" autoComplete="street-address" /></Field>}
                  <fieldset><legend className="mb-2 text-sm font-bold">{t.payment}</legend><div className="grid grid-cols-2 gap-2"><Choice label={t.cash} checked={form.payment === "cod"} onChange={() => setForm({ ...form, payment: "cod" })} /><Choice label={t.upi} checked={form.payment === "upi_on_delivery"} onChange={() => setForm({ ...form, payment: "upi_on_delivery" })} /></div></fieldset>
                  <Field label={t.notes}><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input min-h-20" /></Field>
                  {submitError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{submitError}</p>}
                  <button disabled={submitting} className="w-full rounded-xl px-5 py-3.5 font-bold text-white disabled:opacity-60" style={{ backgroundColor: brandColour }}>{submitting ? t.placingOrder : t.placeOrder}</button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold">{label}</span>{children}</label>;
}

function Choice({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return <label className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-semibold ${checked ? "border-slate-900 bg-slate-50" : "border-slate-300"}`}><input type="radio" checked={checked} onChange={onChange} />{label}</label>;
}

function CategoryButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"}`}
    >
      {label}
    </button>
  );
}
