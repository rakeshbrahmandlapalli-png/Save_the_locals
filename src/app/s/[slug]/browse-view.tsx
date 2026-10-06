"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ArrowLeft, Search, SearchX, X } from "lucide-react";
import { ProductGrid, matchesQuery } from "./home-view";
import { plural, useStore, type Layer } from "./store-context";
import type { Product } from "./page";

type Sort = "shop" | "price-asc" | "price-desc" | "name";

const PRICE_BANDS = [
  { id: "lt50", label: "Under ₹50", test: (price: number) => price < 50 },
  { id: "50-150", label: "₹50–₹150", test: (price: number) => price >= 50 && price <= 150 },
  { id: "gt150", label: "Over ₹150", test: (price: number) => price > 150 },
] as const;

/** Focused browsing for one aisle, one collection, or the whole shop. */
export function BrowseView({ layer, depth }: { layer: Extract<Layer, { kind: "category" | "collection" }>; depth: number }) {
  const { aisles, products, productById, collections, back } = useStore();

  const { title, base, accent } = useMemo(() => {
    if (layer.kind === "category") {
      const aisle = aisles.find((item) => item.id === layer.id);
      return { title: aisle?.name ?? "Aisle", base: products.filter((product) => product.category_id === layer.id), accent: aisle?.accent ?? "sage" };
    }
    if (layer.id === "all") return { title: "All products", base: products, accent: "sage" as const };
    const collection = collections.find((item) => item.id === layer.id);
    return {
      title: collection?.title ?? "Collection",
      base: (collection?.productIds ?? []).map((id) => productById.get(id)).filter((product): product is Product => Boolean(product)),
      accent: collection?.accent ?? "sage",
    };
  }, [layer, aisles, products, productById, collections]);

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [aisleFilter, setAisleFilter] = useState<string>("all");
  const [band, setBand] = useState<string | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("shop");
  const deferred = useDeferredValue(query.trim().toLocaleLowerCase());

  // Filters adapt to what is actually here: aisle chips for mixed lists, price bands for one aisle.
  const aisleChips = layer.kind === "collection" ? aisles.filter((aisle) => base.some((product) => product.category_id === aisle.id)) : [];
  const bandChips = layer.kind === "category" ? PRICE_BANDS.filter((item) => base.some((product) => item.test(product.price)) && !base.every((product) => item.test(product.price))) : [];
  const hasOutOfStock = base.some((product) => !product.in_stock);

  const shown = useMemo(() => {
    const list = base.filter((product) => {
      if (deferred && !matchesQuery(product, deferred)) return false;
      if (aisleFilter !== "all" && product.category_id !== aisleFilter) return false;
      if (band && !PRICE_BANDS.find((item) => item.id === band)?.test(product.price)) return false;
      if (inStockOnly && !product.in_stock) return false;
      return true;
    });
    if (sort === "price-asc") return [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") return [...list].sort((a, b) => b.price - a.price);
    if (sort === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [base, deferred, aisleFilter, band, inStockOnly, sort]);

  const filtered = Boolean(deferred) || aisleFilter !== "all" || band !== null || inStockOnly;
  function clearFilters() {
    setQuery("");
    setAisleFilter("all");
    setBand(null);
    setInStockOnly(false);
  }

  return (
    <div className="animate-side fixed inset-0 overflow-y-auto overscroll-contain bg-[var(--ivory)] pb-[calc(9.5rem+env(safe-area-inset-bottom))]" style={{ zIndex: 30 + depth }} role="dialog" aria-modal="true" aria-label={title}>
      <header className={`accent-${accent} sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--ivory)]`}>
        <div className="mx-auto flex max-w-[1120px] items-center gap-1 px-2 pt-2 sm:px-4">
          <button type="button" onClick={back} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md" aria-label="Back">
            <ArrowLeft className="h-6 w-6" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 truncate text-lg font-bold leading-6">
              <span className="h-4 w-1 shrink-0 rounded-sm bg-[var(--accent)]" aria-hidden="true" />
              <span className="truncate">{title}</span>
            </h1>
            <p className="pl-3 text-xs text-[var(--ink-soft)]">{filtered ? `${shown.length} of ${plural(base.length, "item", "items")}` : plural(base.length, "item", "items")}</p>
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen((value) => !value)}
            aria-expanded={searchOpen || Boolean(query)}
            aria-controls="browse-search"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md"
            aria-label={`Search in ${title}`}
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {(searchOpen || query) && (
          <div className="mx-auto max-w-[1120px] px-4 pt-1 sm:px-6">
            <div className="relative">
              <label className="sr-only" htmlFor="browse-search">Search in {title}</label>
              <input
                id="browse-search"
                type="search"
                enterKeyHint="search"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${title.toLowerCase()}`}
                className="input h-11 pr-11"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-[var(--ink-soft)]" aria-label="Clear search">
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}
        <div className="no-scrollbar mx-auto flex max-w-[1120px] items-center gap-2 overflow-x-auto px-4 py-2.5 sm:px-6" aria-label="Filters">
          <label className="sr-only" htmlFor={`sort-${depth}`}>Sort</label>
          <select id={`sort-${depth}`} value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="chip appearance-none pr-3 font-semibold">
            <option value="shop">Sort: shop order</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name: A to Z</option>
          </select>
          {aisleChips.length > 1 && (
            <>
              <button type="button" className="chip" aria-pressed={aisleFilter === "all"} onClick={() => setAisleFilter("all")}>All aisles</button>
              {aisleChips.map((aisle) => (
                <button key={aisle.id} type="button" className="chip" aria-pressed={aisleFilter === aisle.id} onClick={() => setAisleFilter(aisle.id)}>{aisle.name}</button>
              ))}
            </>
          )}
          {bandChips.map((item) => (
            <button key={item.id} type="button" className="chip" aria-pressed={band === item.id} onClick={() => setBand((current) => (current === item.id ? null : item.id))}>{item.label}</button>
          ))}
          {hasOutOfStock && (
            <button type="button" className="chip" aria-pressed={inStockOnly} onClick={() => setInStockOnly((value) => !value)}>In stock</button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-[1120px] px-4 pt-1 sm:px-6">
        {shown.length > 0 ? (
          <ProductGrid products={shown} />
        ) : (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <SearchX className="h-7 w-7 text-[var(--ink-soft)]" aria-hidden="true" />
            <p className="text-sm text-[var(--ink-soft)]">{base.length === 0 ? "Nothing in this aisle yet." : "Nothing matches these filters."}</p>
            {filtered && <button type="button" className="btn-outline" onClick={clearFilters}>Clear filters</button>}
          </div>
        )}
      </div>
    </div>
  );
}
