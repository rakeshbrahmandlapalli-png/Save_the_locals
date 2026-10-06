"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, MapPin, Phone, RotateCcw, Search, SearchX, ShoppingBasket, X } from "lucide-react";
import { CategoryIcon } from "@/lib/category-icons";
import { copy as t } from "@/lib/copy";
import { createPublicClient } from "@/lib/supabase";
import { ProductCard, ProductMini, ProductRow, ShelfAction, ShelfHeader } from "./product-card";
import { formatMoney, plural, useStore } from "./store-context";
import type { Product } from "./page";

type RepeatItem = {
  order_code: string;
  ordered_at: string;
  product_id: string | null;
  ordered_name: string;
  qty: number;
  price_paid: number;
  available: boolean;
  current_name: string | null;
  current_unit: string | null;
  current_price: number | null;
};

/** "Shop 4, Manikonda, Hyderabad" -> "Manikonda". The full address stays in the store details. */
function shortLocation(address: string | null) {
  if (!address) return null;
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 2];
  return parts[0] ?? null;
}

export function matchesQuery(product: Product, query: string) {
  return `${product.name} ${product.unit}`.toLocaleLowerCase().includes(query);
}

export function HomeView({ deliveredOrderCount }: { deliveredOrderCount: number }) {
  const store = useStore();
  const { shop, aisles, products, productById, collections, usuals, units, remaining, open, bumpKey } = store;
  const [query, setQuery] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const deferred = useDeferredValue(query.trim().toLocaleLowerCase());
  const location = shortLocation(shop.address);

  const results = useMemo(() => (deferred ? products.filter((product) => matchesQuery(product, deferred)) : []), [products, deferred]);
  const usualProducts = usuals.map((usual) => productById.get(usual.product_id)).filter((product): product is Product => Boolean(product?.in_stock));
  const collection = (id: string) => collections.find((item) => item.id === id);
  const productsOf = (ids: string[]) => ids.map((id) => productById.get(id)).filter((product): product is Product => Boolean(product));
  const underFifty = collection("under-50");
  const smallCatalogue = products.length < 8;

  return (
    <main className="mx-auto w-full max-w-[1120px]" aria-labelledby="store-name">
      <header className="px-4 pb-3 pt-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 id="store-name" className="text-brand-deep truncate font-serif text-[17px] font-semibold leading-6" title={shop.name}>{shop.name}</h1>
            <button
              type="button"
              onClick={() => setDetailsOpen((value) => !value)}
              aria-expanded={detailsOpen}
              aria-controls="store-details"
              className="-ml-1 mt-0.5 flex min-h-11 max-w-full items-center gap-1.5 rounded-md px-1 text-left"
            >
              <MapPin className="text-brand-deep h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <span className="truncate text-lg font-bold leading-6">{location ?? "Store details"}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--ink-soft)] transition-transform ${detailsOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            <p className="text-[13px] text-[var(--ink-soft)]">
              {shop.delivery_fee > 0 ? `₹${formatMoney(shop.delivery_fee)} delivery` : "Free delivery"} · ₹{formatMoney(shop.min_order)} minimum order
            </p>
          </div>
          <BasketButton units={units} bumpKey={bumpKey} onOpen={() => open({ kind: "basket" })} />
        </div>
        {detailsOpen && (
          <div id="store-details" className="surface mt-3 space-y-1.5 p-3 text-sm">
            <p className="font-semibold">{shop.name}</p>
            {shop.address && <p className="text-[var(--ink-soft)]">{shop.address}</p>}
            <p className="text-[var(--ink-soft)]">Delivers within {formatMoney(shop.delivery_radius_km)} km. Pickup from the shop is free.</p>
            {deliveredOrderCount >= 5 && <p className="text-[var(--ink-soft)]">{t.deliveredOrders(new Intl.NumberFormat("en-IN").format(deliveredOrderCount))}</p>}
            {shop.phone && (
              <a href={`tel:${shop.phone}`} className="text-brand-deep inline-flex min-h-11 items-center gap-2 font-semibold">
                <Phone className="h-4 w-4" aria-hidden="true" />
                Call the shop
              </a>
            )}
          </div>
        )}
      </header>

      <div className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--ivory)] px-4 pb-3 pt-1 sm:px-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--ink-soft)]" aria-hidden="true" />
          <label className="sr-only" htmlFor="product-search">Search products</label>
          <input
            id="product-search"
            type="search"
            enterKeyHint="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${plural(products.length, "product", "products")}`}
            className="h-12 w-full rounded-lg border border-[var(--line-strong)] bg-white pl-11 pr-11 text-base outline-none placeholder:text-[var(--ink-soft)] focus:border-[var(--brand)]"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-[var(--ink-soft)]" aria-label="Clear search">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {deferred ? (
        <section className="px-4 pt-4 sm:px-6" aria-live="polite">
          <p className="text-sm text-[var(--ink-soft)]">{plural(results.length, "result", "results")} for “{query.trim()}”</p>
          {results.length > 0 ? (
            <ProductGrid products={results} />
          ) : (
            <div className="mt-6 flex flex-col items-center gap-3 text-center">
              <SearchX className="h-7 w-7 text-[var(--ink-soft)]" aria-hidden="true" />
              <p className="text-sm text-[var(--ink-soft)]">Nothing called that here. Try another word, or browse an aisle.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {aisles.map((aisle) => (
                  <button key={aisle.id} type="button" className="chip" onClick={() => open({ kind: "category", id: aisle.id })}>{aisle.name}</button>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-7 px-4 pt-4 sm:px-6">
          {units > 0 && remaining > 0 && underFifty && (
            <button
              type="button"
              onClick={() => open({ kind: "collection", id: "under-50" })}
              className="accent-slate surface flex w-full items-center gap-3 border-l-[3px] border-l-[var(--accent)] px-3.5 py-3 text-left"
            >
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-semibold">₹{formatMoney(remaining)} to go</span> for the ₹{formatMoney(shop.min_order)} minimum. Small add-ons under ₹50.
              </span>
              <ArrowRight className="text-brand-deep h-5 w-5 shrink-0" aria-hidden="true" />
            </button>
          )}

          <BuyAgain usualProducts={usualProducts} />

          {aisles.length > 0 && (
            <section aria-labelledby="aisles-heading">
              <ShelfHeader id="aisles-heading" title="Aisles" action={<ShelfAction onClick={() => open({ kind: "collection", id: "all" })}>All products</ShelfAction>} />
              <div className={aisles.length > 8 ? "no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4" : `mt-3 grid grid-cols-4 gap-2 ${aisles.length > 6 ? "sm:grid-cols-6 lg:grid-cols-8" : aisles.length > 4 ? "sm:grid-cols-6" : ""}`}>
                {aisles.map((aisle) => (
                  <button
                    key={aisle.id}
                    type="button"
                    onClick={() => open({ kind: "category", id: aisle.id })}
                    className={`accent-${aisle.accent} bg-accent-tint flex min-h-[5.25rem] flex-col items-center justify-center gap-1.5 rounded-[var(--radius)] px-1 py-2 text-center ${aisles.length > 8 ? "w-20 shrink-0" : ""}`}
                  >
                    <CategoryIcon icon={aisle.icon} className="text-accent h-7 w-7 [stroke-width:1.5]" />
                    <span className="line-clamp-2 text-[12px] font-semibold leading-4">{aisle.name}</span>
                    <span className="sr-only">, {plural(aisle.productIds.length, "item", "items")}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {smallCatalogue ? (
            <section aria-labelledby="all-heading">
              <ShelfHeader id="all-heading" title="Everything" />
              <ProductGrid products={products} />
            </section>
          ) : (
            collections.map((item) => {
              const list = productsOf(item.productIds);
              const headingId = `collection-${item.id}`;
              const seeAll = <ShelfAction onClick={() => open({ kind: "collection", id: item.id })} label={`See all ${item.title}`}>See all {list.length}</ShelfAction>;
              if (item.id === "under-50") {
                return (
                  <section key={item.id} aria-labelledby={headingId}>
                    <ShelfHeader id={headingId} title={item.title} accent={item.accent} action={seeAll} />
                    <ul className="surface mt-3 divide-y divide-[var(--line)] px-3">
                      {list.slice(0, 4).map((product) => <ProductRow key={product.id} product={product} />)}
                    </ul>
                  </section>
                );
              }
              if (item.id === "cooking") {
                return (
                  <section key={item.id} aria-labelledby={headingId}>
                    <ShelfHeader id={headingId} title={item.title} accent={item.accent} action={seeAll} />
                    <ProductGrid products={list.slice(0, 4)} />
                  </section>
                );
              }
              return (
                <section key={item.id} aria-labelledby={headingId}>
                  <ShelfHeader id={headingId} title={item.title} accent={item.accent} action={seeAll} />
                  <Shelf products={list} />
                </section>
              );
            })
          )}

          {!smallCatalogue && (
            <button type="button" onClick={() => open({ kind: "collection", id: "all" })} className="btn-outline h-12 w-full text-[15px]">
              Browse all {products.length} products
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <footer className="mt-8 px-4 pb-4 text-xs text-[var(--ink-soft)] sm:px-6">
        <div className="receipt-rule flex flex-wrap gap-x-4 gap-y-1 pt-3">
          <Link href="/terms" className="inline-flex min-h-8 items-center underline underline-offset-4">{t.termsWord}</Link>
          <Link href="/privacy" className="inline-flex min-h-8 items-center underline underline-offset-4">{t.privacyWord}</Link>
          <Link href="/refund-policy" className="inline-flex min-h-8 items-center underline underline-offset-4">Refunds &amp; cancellations</Link>
        </div>
      </footer>
    </main>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product) => <ProductCard key={product.id} product={product} />)}
    </div>
  );
}

export function Shelf({ products }: { products: Product[] }) {
  return (
    <div className="no-scrollbar -mx-4 mt-3 flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:scroll-px-6 sm:px-6" role="list">
      {products.map((product) => (
        <div role="listitem" key={product.id} className="flex">
          <ProductMini product={product} />
        </div>
      ))}
    </div>
  );
}

export function BasketButton({ units, bumpKey, onOpen }: { units: number; bumpKey: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="surface relative flex h-11 w-11 shrink-0 items-center justify-center"
      aria-label={units > 0 ? `Basket, ${plural(units, "unit", "units")}` : "Basket, empty"}
    >
      <ShoppingBasket className="h-5 w-5" aria-hidden="true" />
      {units > 0 && (
        <span key={bumpKey} className="bg-brand-deep animate-bump absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white">{units}</span>
      )}
    </button>
  );
}

function BuyAgain({ usualProducts }: { usualProducts: Product[] }) {
  const { shop, addItems, usuals, usualsReady, setForm } = useStore();
  const [openLookup, setOpenLookup] = useState(false);
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "found" | "empty" | "error">("idle");
  const [items, setItems] = useState<RepeatItem[]>([]);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setError("");
    setAdded(false);
    try {
      const { data, error: rpcError } = await createPublicClient().rpc("last_order_items", { shop_slug: shop.slug, phone });
      if (rpcError) {
        setStatus("error");
        setError(rpcError.message);
        return;
      }
      const rows = (data ?? []) as RepeatItem[];
      setItems(rows);
      setStatus(rows.length > 0 ? "found" : "empty");
    } catch {
      setStatus("error");
      setError("We couldn't reach the shop. Check your connection and try again.");
    }
  }

  function addFound() {
    addItems(items.filter((item) => item.available && item.product_id).map((item) => ({ productId: item.product_id as string, qty: item.qty })));
    setForm((current) => ({ ...current, phone }));
    setAdded(true);
  }

  if (!usualsReady) return null;

  if (usualProducts.length > 0) {
    return (
      <section aria-labelledby="buy-again-heading">
        <ShelfHeader
          id="buy-again-heading"
          title="Buy again"
          action={usualProducts.length > 1 ? (
            <ShelfAction onClick={() => addItems(usuals.filter((usual) => usualProducts.some((product) => product.id === usual.product_id)).map((usual) => ({ productId: usual.product_id, qty: usual.qty })))}>
              Add all {usualProducts.length}
            </ShelfAction>
          ) : undefined}
        />
        <p className="mt-1.5 text-xs text-[var(--ink-soft)]">From your last order on this phone.</p>
        <Shelf products={usualProducts} />
      </section>
    );
  }

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpenLookup((value) => !value)}
        aria-expanded={openLookup}
        className="surface flex min-h-12 w-full items-center gap-3 px-3.5 text-left"
      >
        <RotateCcw className="text-brand-deep h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Buy again</span>
          <span className="block text-xs text-[var(--ink-soft)]">Ordered here before? Find your last order.</span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-[var(--ink-soft)] transition-transform ${openLookup ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {openLookup && (
        <div className="surface mt-2 p-3.5 text-sm">
          <form onSubmit={lookup} className="flex gap-2">
            <label className="sr-only" htmlFor="repeat-phone">{t.mobile}</label>
            <input id="repeat-phone" required type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Mobile number you ordered with" className="input flex-1" />
            <button disabled={status === "loading"} className="btn-primary h-11 min-h-11 shrink-0 px-4 text-sm">
              {status === "loading" ? "Finding…" : "Find"}
            </button>
          </form>
          {status === "error" && <p role="alert" className="mt-3 font-semibold text-red-700">{error}</p>}
          {status === "empty" && <p className="mt-3 text-[var(--ink-soft)]">{t.repeatNotFound}</p>}
          {status === "found" && items.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-[var(--ink-soft)]">{t.repeatBasedOn(items[0].order_code, new Date(items[0].ordered_at).toLocaleDateString("en-IN"))}</p>
              <ul className="mt-2 divide-y divide-[var(--line)]">
                {items.map((item) => {
                  const label = item.available ? (item.current_name ?? item.ordered_name) : item.ordered_name;
                  const priceChanged = item.available && item.current_price !== null && Number(item.current_price) !== Number(item.price_paid);
                  return (
                    <li key={item.product_id ?? item.ordered_name} className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="break-words font-medium">{item.qty} × {label}</p>
                        {!item.available && <p className="text-xs font-semibold text-red-700">{t.repeatUnavailable}</p>}
                        {priceChanged && <p className="text-xs font-semibold text-amber-800">{t.repeatPriceChanged(formatMoney(Number(item.price_paid)), formatMoney(Number(item.current_price)))}</p>}
                      </div>
                      <p className="shrink-0 font-semibold">{item.available ? `₹${formatMoney(Number(item.current_price))}` : "—"}</p>
                    </li>
                  );
                })}
              </ul>
              <button type="button" onClick={addFound} className="btn-outline mt-2 w-full">{t.repeatAddAll}</button>
              {added && <p className="mt-2 font-semibold text-emerald-800">{t.repeatAdded}</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
