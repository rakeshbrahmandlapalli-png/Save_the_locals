"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { copy, type Language } from "@/lib/copy";
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
            <button type="button" className="rounded-xl px-5 py-3 text-sm font-bold text-white" style={{ backgroundColor: brandColour }}>
              {t.openBasket}
            </button>
          </div>
          <p className={`mt-2 text-xs font-semibold ${remaining > 0 ? "text-amber-700" : "text-emerald-700"}`}>
            {remaining > 0 ? t.minimumRemaining(formatMoney(remaining)) : t.minimumReached}
          </p>
        </aside>
      )}
    </main>
  );
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
