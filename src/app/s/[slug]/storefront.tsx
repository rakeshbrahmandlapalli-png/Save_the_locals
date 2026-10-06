"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { copy } from "@/lib/copy";
import { CategoryIcon } from "@/lib/category-icons";
import { ArrowLeft, ArrowRight, Banknote, Bike, Check, ChevronDown, ChevronRight, LayoutGrid, MapPin, Phone, Search, SearchX, ShoppingBag, ShoppingBasket, ShoppingCart, Smartphone, Store, Trash2, Truck } from "lucide-react";
import { createPublicClient } from "@/lib/supabase";
import { RegisterServiceWorker } from "./register-service-worker";
import { BottomNav } from "./bottom-nav";
import { ProductImage } from "./product-image";
import { AddButton, MAX_QTY, QtyStepper } from "./quantity-controls";
import type { Category, Product, Shop } from "./page";

type Quantities = Record<string, number>;
type UsualItem = { product_id: string; qty: number };

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

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
}

function plural(count: number, one: string, many: string) {
  return `${new Intl.NumberFormat("en-IN").format(count)} ${count === 1 ? one : many}`;
}

/** "Shop 4, Manikonda, Hyderabad" -> "Manikonda". The full address stays in the store details. */
function shortLocation(address: string | null) {
  if (!address) return null;
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 2];
  return parts[0] ?? null;
}

export function Storefront({
  shop,
  categories,
  products,
  initialSource,
  deliveredOrderCount,
}: {
  shop: Shop;
  categories: Category[];
  products: Product[];
  initialSource: string | null;
  deliveredOrderCount: number;
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [quantities, setQuantities] = useState<Quantities>({});
  const [source, setSource] = useState("direct");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [step, setStep] = useState<"basket" | "checkout">("basket");
  const [usuals, setUsuals] = useState<UsualItem[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [buyAgainOpen, setBuyAgainOpen] = useState(false);
  const [compactBar, setCompactBar] = useState(false);
  const [notice, setNotice] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const productsRef = useRef<HTMLElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderCode, setOrderCode] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", fulfilment: "delivery", address: "", payment: "cod", notes: "" });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [repeatPhone, setRepeatPhone] = useState("");
  const [repeatStatus, setRepeatStatus] = useState<"idle" | "loading" | "found" | "empty" | "error">("idle");
  const [repeatItems, setRepeatItems] = useState<RepeatItem[]>([]);
  const [repeatError, setRepeatError] = useState("");
  const [repeatAdded, setRepeatAdded] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const t = copy;

  useEffect(() => {
    overlayRef.current?.scrollTo({ top: 0 });
  }, [step, checkoutOpen]);

  // Keep the page behind the basket from scrolling; the page's own scroll position is untouched.
  useEffect(() => {
    if (!checkoutOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [checkoutOpen]);

  // The category bar collapses into text tabs once the page is scrolled. The gap between the two
  // thresholds stops it flickering when the height change nudges the scroll position.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setCompactBar((current) => (current ? y > 140 : y > 260));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A checkout error is rendered inside the scrolling form; bring it into view above the fixed bar.
  useEffect(() => {
    if (!submitError) return;
    overlayRef.current?.querySelector('[role="alert"]')?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [submitError]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

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

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`stl-usuals:${shop.slug}`) ?? "[]");
      if (Array.isArray(saved)) setUsuals(saved.filter((item): item is UsualItem => typeof item?.product_id === "string" && Number(item?.qty) > 0));
    } catch {
      // Storage can be unavailable (private mode); "Buy again" just won't offer this device's last order.
    }
  }, [shop.slug]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const inCategory = categoryId === "all" || product.category_id === categoryId;
      const searchable = `${product.name} ${product.unit}`.toLocaleLowerCase();
      return inCategory && searchable.includes(deferredQuery);
    });
  }, [products, categoryId, deferredQuery]);

  const sections = useMemo(() => {
    if (categoryId !== "all" || deferredQuery !== "") return null;
    const byCategory = new Map<string, Product[]>();
    for (const product of filteredProducts) {
      const key = product.category_id ?? "";
      const list = byCategory.get(key) ?? [];
      list.push(product);
      byCategory.set(key, list);
    }
    const ordered: { key: string; label: string; icon: string | null; items: Product[] }[] = [];
    for (const category of categories) {
      const items = byCategory.get(category.id);
      if (items && items.length > 0) ordered.push({ key: category.id, label: category.name, icon: category.icon, items });
    }
    const uncategorised = byCategory.get("");
    if (uncategorised && uncategorised.length > 0) ordered.push({ key: "uncategorised", label: "Other", icon: null, items: uncategorised });
    return ordered.length > 1 ? ordered : null;
  }, [categoryId, deferredQuery, filteredProducts, categories]);

  const itemCount = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
  const total = products.reduce((sum, product) => sum + product.price * (quantities[product.id] ?? 0), 0);
  const remaining = Math.max(0, shop.min_order - total);
  const brandColour = shop.brand?.primary_colour || "#285943";
  const basketProducts = products.filter((product) => (quantities[product.id] ?? 0) > 0);
  const deliveryCharge = form.fulfilment === "delivery" ? shop.delivery_fee : 0;
  const grandTotal = total + deliveryCharge;
  const countLabel = `${plural(itemCount, "unit", "units")} · ${plural(basketProducts.length, "product", "products")}`;
  const usualProducts = usuals
    .map((usual) => ({ usual, product: products.find((product) => product.id === usual.product_id && product.in_stock) }))
    .filter((entry): entry is { usual: UsualItem; product: Product } => Boolean(entry.product));
  const suggestion = products.find((product) => product.in_stock && !(quantities[product.id] > 0));
  const location = shortLocation(shop.address);

  /** Sets an absolute quantity (0 removes), clamped to 1..MAX_QTY. */
  const setQuantity = useCallback((productId: string, quantity: number) => {
    setQuantities((current) => {
      const next = Math.min(MAX_QTY, Math.max(0, Math.floor(quantity)));
      if (next === 0) {
        const { [productId]: _removed, ...rest } = current;
        void _removed;
        return rest;
      }
      return { ...current, [productId]: next };
    });
  }, []);

  function addToQuantity(current: Quantities, productId: string, qty: number) {
    return Math.min(MAX_QTY, (current[productId] ?? 0) + qty);
  }

  function selectCategory(id: string) {
    setCategoryId(id);
    // If the list is already scrolled past its top, start the new list at the top (below the bar).
    window.requestAnimationFrame(() => {
      const listTop = (productsRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
      const offset = barRef.current?.offsetHeight ?? 56;
      if (window.scrollY > listTop - offset) window.scrollTo({ top: Math.max(0, listTop - offset - 4) });
    });
  }

  function closeOverlay() {
    setCheckoutOpen(false);
    setStep("basket");
  }

  function backToShopAfterOrder() {
    setQuantities({});
    setOrderCode(null);
    setAgreedToTerms(false);
    closeOverlay();
  }

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agreedToTerms) {
      setSubmitError(t.agreeRequired);
      return;
    }
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
    try {
      localStorage.setItem(`stl-usuals:${shop.slug}`, JSON.stringify(items));
    } catch {
      // Not critical: the order is already placed.
    }
  }

  async function checkRepeatOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRepeatStatus("loading");
    setRepeatError("");
    setRepeatAdded(false);
    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc("last_order_items", { shop_slug: shop.slug, phone: repeatPhone });
    if (error) {
      setRepeatStatus("error");
      setRepeatError(error.message);
      return;
    }
    const rows = (data ?? []) as RepeatItem[];
    setRepeatItems(rows);
    setRepeatStatus(rows.length > 0 ? "found" : "empty");
  }

  function addRepeatItemsToBasket() {
    setQuantities((current) => {
      const next = { ...current };
      for (const item of repeatItems) {
        if (item.available && item.product_id) next[item.product_id] = addToQuantity(current, item.product_id, item.qty);
      }
      return next;
    });
    setForm((current) => ({ ...current, phone: repeatPhone }));
    setRepeatAdded(true);
  }

  function buyUsualsAgain() {
    setQuantities((current) => {
      const next = { ...current };
      for (const { usual, product } of usualProducts) next[product.id] = addToQuantity(current, product.id, usual.qty);
      return next;
    });
  }

  const tabs = [{ id: "all", label: t.allCategories, icon: null as string | null }, ...categories.map((category) => ({ id: category.id, label: category.name, icon: category.icon }))];

  return (
    <main
      className={`mx-auto min-h-screen max-w-2xl bg-[var(--paper)] text-[var(--ink)] sm:shadow-[0_0_0_1px_var(--line)] ${itemCount > 0 ? "pb-[calc(9rem+env(safe-area-inset-bottom))]" : "pb-[calc(4.5rem+env(safe-area-inset-bottom))]"}`}
      data-order-source={source}
      style={{ "--brand": brandColour } as React.CSSProperties}
    >
      <RegisterServiceWorker />
      <header className="px-4 pb-2 pt-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-brand-deep min-w-0 break-words font-serif text-[22px] font-semibold leading-tight tracking-tight">{shop.name}</h1>
          <button
            type="button"
            onClick={() => itemCount > 0 && setCheckoutOpen(true)}
            className="bg-card relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            aria-label={`${t.basket}: ${countLabel}`}
          >
            <ShoppingCart className="h-5 w-5" aria-hidden="true" />
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[11px] font-bold text-white">{itemCount}</span>
            )}
          </button>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-[var(--ink-soft)]">
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
            aria-label="Store details"
            className="-my-3 flex min-h-11 items-center gap-1 py-3 text-[13px]"
          >
            <MapPin className="text-brand-deep h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="font-semibold text-[var(--ink)]">{location ?? "Store details"}</span>
            <ChevronDown className={`text-brand-deep h-3.5 w-3.5 transition-transform ${detailsOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          <span aria-hidden="true">·</span>
          <span>{shop.delivery_fee > 0 ? `₹${formatMoney(shop.delivery_fee)} delivery` : "Free delivery"}</span>
          <span aria-hidden="true">·</span>
          <span>Min ₹{formatMoney(shop.min_order)}</span>
        </div>
        {detailsOpen && (
          <div className="bg-card mt-2 space-y-1.5 rounded-xl p-3 text-sm">
            {shop.address && <p className="flex gap-2"><MapPin className="text-brand-deep mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{shop.address}</p>}
            <p className="text-[var(--ink-soft)]">Delivers within {formatMoney(shop.delivery_radius_km)} km</p>
            {deliveredOrderCount >= 5 && <p className="text-[var(--ink-soft)]">{t.deliveredOrders(new Intl.NumberFormat("en-IN").format(deliveredOrderCount))}</p>}
            {shop.phone && (
              <a href={`tel:${shop.phone}`} className="text-brand-deep inline-flex min-h-11 items-center gap-2 font-semibold">
                <Phone className="h-4 w-4" aria-hidden="true" />
                Call {shop.phone}
              </a>
            )}
          </div>
        )}
        <div className="relative mt-2.5">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-stone-500" aria-hidden="true" />
          <label className="sr-only" htmlFor="product-search">{t.searchPlaceholder}</label>
          <input
            id="product-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.searchPlaceholder}
            className="h-11 w-full rounded-full border border-stone-300 bg-transparent pl-11 pr-4 text-base outline-none placeholder:text-stone-500 focus:border-[var(--brand)] focus:bg-white"
          />
        </div>
      </header>

      <section className="px-4">
        <button
          type="button"
          onClick={() => setBuyAgainOpen((open) => !open)}
          aria-expanded={buyAgainOpen}
          className="bg-card flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-4 text-left"
        >
          <span className="flex items-baseline gap-2">
            <span className="text-[15px] font-bold">Buy again</span>
            <span className="text-xs text-[var(--ink-soft)]">{usualProducts.length > 0 ? `${plural(usualProducts.length, "product", "products")} from your last order` : "Same as last time"}</span>
          </span>
          <ChevronRight className={`text-brand-deep h-5 w-5 shrink-0 transition-transform ${buyAgainOpen ? "rotate-90" : ""}`} aria-hidden="true" />
        </button>
        {buyAgainOpen && (
          <div className="bg-card mt-1 rounded-xl p-4 text-sm">
            {usualProducts.length > 0 && (
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
                <div className="flex -space-x-2" aria-hidden="true">
                  {usualProducts.slice(0, 3).map(({ product }) => (
                    <ProductImage key={product.id} src={product.image_url} alt="" className="h-10 w-10 rounded-full ring-2 ring-white" iconClassName="h-4 w-4" />
                  ))}
                </div>
                <button type="button" onClick={buyUsualsAgain} className="bg-brand-deep h-11 shrink-0 rounded-lg px-4 text-sm font-semibold text-white">
                  Add all {plural(usualProducts.length, "product", "products")}
                </button>
              </div>
            )}
            <p className="text-xs text-[var(--ink-soft)]">{t.repeatPrompt}</p>
            <form onSubmit={checkRepeatOrder} className="mt-2 flex gap-2">
              <label className="sr-only" htmlFor="repeat-phone">{t.mobile}</label>
              <input id="repeat-phone" required inputMode="tel" value={repeatPhone} onChange={(e) => setRepeatPhone(e.target.value)} placeholder={t.phoneHint} className="input h-11 flex-1 !rounded-xl !py-0" />
              <button disabled={repeatStatus === "loading"} className="bg-brand-deep h-11 shrink-0 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-60">
                {repeatStatus === "loading" ? t.repeatChecking : t.repeatCheck}
              </button>
            </form>
            {repeatStatus === "error" && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{repeatError}</p>}
            {repeatStatus === "empty" && <p className="mt-3 text-sm text-[var(--ink-soft)]">{t.repeatNotFound}</p>}
            {repeatStatus === "found" && repeatItems.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-[var(--ink-soft)]">{t.repeatBasedOn(repeatItems[0].order_code, new Date(repeatItems[0].ordered_at).toLocaleDateString("en-IN"))}</p>
                <ul className="mt-2 space-y-2">
                  {repeatItems.map((item) => {
                    const displayLabel = item.available ? (item.current_name ?? item.ordered_name) : item.ordered_name;
                    const priceChanged = item.available && item.current_price !== null && Number(item.current_price) !== Number(item.price_paid);
                    return (
                      <li key={item.product_id ?? item.ordered_name} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm">
                        <div className="min-w-0">
                          <p className="break-words font-semibold">{item.qty} × {displayLabel}</p>
                          {!item.available && <p className="text-xs font-semibold text-red-700">{t.repeatUnavailable}</p>}
                          {priceChanged && <p className="text-xs font-semibold text-amber-700">{t.repeatPriceChanged(formatMoney(Number(item.price_paid)), formatMoney(Number(item.current_price)))}</p>}
                        </div>
                        <p className="shrink-0 font-bold">{item.available ? `₹${formatMoney(Number(item.current_price))}` : "—"}</p>
                      </li>
                    );
                  })}
                </ul>
                <button type="button" onClick={addRepeatItemsToBasket} className="bg-brand-deep mt-3 h-11 w-full rounded-xl px-4 text-sm font-semibold text-white">
                  {t.repeatAddAll}
                </button>
                {repeatAdded && <p className="mt-2 text-sm font-semibold text-emerald-700">{t.repeatAdded}</p>}
              </div>
            )}
          </div>
        )}
      </section>

      <div ref={barRef} className="sticky top-0 z-10 mt-2 bg-[var(--paper)]/95 backdrop-blur-md">
        <div className={`no-scrollbar flex overflow-x-auto px-4 ${compactBar ? "gap-1 py-1.5" : "gap-2 py-2"}`} role="tablist" aria-label="Product categories">
          {tabs.map((tab) => {
            const active = categoryId === tab.id;
            return compactBar ? (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectCategory(tab.id)}
                className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition ${active ? "bg-brand-deep text-white" : "text-stone-600"}`}
              >
                {tab.label}
              </button>
            ) : (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectCategory(tab.id)}
                className="flex min-h-[4.25rem] w-16 shrink-0 flex-col items-center gap-1"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-full ${active ? "bg-brand-tint text-brand-deep" : "bg-card text-stone-600"}`}>
                  {tab.id === "all" ? <LayoutGrid className="h-5 w-5" aria-hidden="true" /> : <CategoryIcon icon={tab.icon} className="h-5 w-5" />}
                </span>
                <span className={`max-w-full truncate border-b-2 text-[11px] leading-4 ${active ? "text-brand-deep border-brand font-bold" : "border-transparent font-medium text-stone-600"}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <section ref={productsRef} className="px-4 pt-2">
        {filteredProducts.length === 0 ? (
          <div className="bg-card flex flex-col items-center gap-2 rounded-2xl px-4 py-12 text-center">
            <SearchX className="h-7 w-7 text-[var(--ink-soft)]" aria-hidden="true" />
            <p className="text-sm text-[var(--ink-soft)]">{products.length === 0 ? "This shop has no products yet." : t.emptySearch}</p>
            {products.length > 0 && (query || categoryId !== "all") && (
              <button type="button" onClick={() => { setQuery(""); setCategoryId("all"); }} className="text-brand-deep min-h-11 px-3 text-sm font-semibold">Clear search and filters</button>
            )}
          </div>
        ) : (
          sections ? (
            <div className="space-y-6">
              {sections.map((section) => (
                <div key={section.key}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h2 className="font-serif text-xl font-semibold tracking-tight">{section.label}</h2>
                    {section.key !== "uncategorised" && (
                      <button type="button" onClick={() => selectCategory(section.key)} className="text-brand-deep -mr-2 flex min-h-11 items-center px-2 text-sm font-semibold">See all</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
                    {section.items.map((product) => (
                      <ProductCard key={product.id} product={product} quantity={quantities[product.id] ?? 0} t={t} onSet={setQuantity} onNotice={setNotice} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} quantity={quantities[product.id] ?? 0} t={t} onSet={setQuantity} onNotice={setNotice} />
              ))}
            </div>
          )
        )}
      </section>

      <footer className="mt-5 px-5 pb-2 pt-3 text-xs text-[var(--ink-soft)]">
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--line)] pt-3">
          <Link href="/terms" className="underline decoration-[var(--line)] underline-offset-4">{t.termsWord}</Link>
          <Link href="/privacy" className="underline decoration-[var(--line)] underline-offset-4">{t.privacyWord}</Link>
          <Link href="/refund-policy" className="underline decoration-[var(--line)] underline-offset-4">Refund &amp; cancellation policy</Link>
        </div>
      </footer>

      {notice && (
        <p role="status" className="fixed inset-x-4 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-50 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-full bg-stone-900 px-4 py-2 text-center text-sm font-medium text-white shadow-lg">
          {notice}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20" style={{ "--brand": brandColour } as React.CSSProperties}>
        {itemCount > 0 && (
          <div className="animate-slide-up mx-auto max-w-2xl px-3 pb-2">
            {remaining > 0 && (
              <p className="mx-2 -mb-2 rounded-t-xl bg-amber-100 px-4 pb-3 pt-1.5 text-center text-xs font-semibold text-amber-900">
                {t.minimumRemaining(formatMoney(remaining))}
              </p>
            )}
            <button
              type="button"
              onClick={() => setCheckoutOpen(true)}
              className="bg-brand-deep relative flex min-h-14 w-full items-center justify-between gap-4 rounded-xl px-4 text-left text-white shadow-[0_10px_28px_-8px_rgba(0,0,0,0.5)]"
            >
              <span className="flex min-w-0 items-center gap-3">
                <ShoppingBag className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-medium leading-4 text-white/75">{countLabel}</span>
                  <span className="block text-lg font-bold leading-6">₹{formatMoney(total)}</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-sm font-bold">
                {t.openBasket}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </button>
          </div>
        )}
        <BottomNav slug={shop.slug} active="home" onHome={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
      </div>

      {checkoutOpen && (
        <div ref={overlayRef} className="fixed inset-0 z-30 overflow-y-auto overscroll-contain bg-[var(--paper)]" role="dialog" aria-modal="true" aria-label={step === "basket" ? "Your basket" : "Checkout"} style={{ "--brand": brandColour } as React.CSSProperties}>
          {orderCode ? (
            <div className="animate-sheet mx-auto flex min-h-full max-w-2xl flex-col px-4 pb-6">
              <div className="my-auto py-16 text-center">
                <span className="bg-brand-tint text-brand-deep mx-auto flex h-16 w-16 items-center justify-center rounded-full">
                  <Check className="h-8 w-8" aria-hidden="true" />
                </span>
                <p className="mt-4 text-sm font-bold text-emerald-700">{t.orderPlaced}</p>
                <h2 className="mt-1 font-serif text-2xl font-semibold">{t.orderCode}</h2>
                <p className="bg-brand-soft text-brand-deep mx-auto mt-4 inline-block rounded-2xl px-6 py-3 text-4xl font-black tracking-[0.18em]">{orderCode}</p>
                <p className="mt-4 text-sm text-[var(--ink-soft)]">{t.keepCode}</p>
                <div className="mt-6 flex flex-col items-center gap-2">
                  <a href={`/s/${shop.slug}/status?code=${orderCode}`} className="bg-brand-deep inline-flex min-h-12 items-center rounded-xl px-6 font-semibold text-white">{t.checkStatus}</a>
                  <button type="button" onClick={backToShopAfterOrder} className="text-brand-deep min-h-11 px-4 text-sm font-semibold">Back to shop</button>
                </div>
              </div>
            </div>
          ) : step === "basket" ? (
            <>
              <div className="animate-sheet mx-auto flex min-h-full max-w-2xl flex-col px-4 pb-[calc(9rem+env(safe-area-inset-bottom))]">
                <div className="flex items-center gap-2 py-3">
                  <button type="button" onClick={closeOverlay} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Back to shop"><ArrowLeft className="h-6 w-6" aria-hidden="true" /></button>
                  <div>
                    <h2 className="font-serif text-2xl font-semibold leading-tight">Your basket</h2>
                    {basketProducts.length > 0 && <p className="text-sm text-[var(--ink-soft)]">{countLabel}</p>}
                  </div>
                </div>
                {basketProducts.length === 0 ? (
                  <div className="my-auto flex flex-col items-center gap-3 py-20 text-center">
                    <span className="bg-card flex h-16 w-16 items-center justify-center rounded-full text-stone-500"><ShoppingBasket className="h-8 w-8" aria-hidden="true" /></span>
                    <p className="font-serif text-xl font-semibold">Your basket is empty</p>
                    <p className="text-sm text-[var(--ink-soft)]">Add a few things from the shop to get started.</p>
                    <button type="button" onClick={closeOverlay} className="bg-brand-deep mt-2 min-h-12 rounded-xl px-6 font-semibold text-white">Start shopping</button>
                  </div>
                ) : (
                  <>
                    <div className="bg-card flex min-h-12 items-center justify-between gap-3 rounded-xl px-4 text-[15px]">
                      <span className="flex items-center gap-2.5">
                        {form.fulfilment === "delivery" ? <Bike className="h-5 w-5" aria-hidden="true" /> : <Store className="h-5 w-5" aria-hidden="true" />}
                        {form.fulfilment === "delivery" ? `${t.delivery} · ${shop.delivery_fee > 0 ? `₹${formatMoney(shop.delivery_fee)}` : t.free}` : `${t.pickup} · ${t.free}`}
                      </span>
                      <button type="button" onClick={() => setForm({ ...form, fulfilment: form.fulfilment === "delivery" ? "pickup" : "delivery" })} className="text-brand-deep -mr-2 min-h-11 px-2 text-sm font-bold">
                        Switch to {form.fulfilment === "delivery" ? t.pickup.toLowerCase() : t.delivery.toLowerCase()}
                      </button>
                    </div>
                    <ul className="mt-1 divide-y divide-[var(--line)]">
                      {basketProducts.map((product) => {
                        const quantity = quantities[product.id] ?? 0;
                        return (
                          <li key={product.id} className="flex gap-3 py-3">
                            <ProductImage src={product.image_url} alt={product.name} className="h-14 w-14 shrink-0 rounded-lg" iconClassName="h-6 w-6" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h3 className="line-clamp-2 break-words text-[15px] font-semibold leading-5">{product.name}</h3>
                                  <p className="text-xs text-[var(--ink-soft)]">{product.unit} · ₹{formatMoney(product.price)} each</p>
                                </div>
                                <p className="shrink-0 text-base font-bold leading-5">₹{formatMoney(product.price * quantity)}</p>
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-3">
                                <QtyStepper quantity={quantity} name={product.name} onSet={(next) => setQuantity(product.id, next)} onNotice={setNotice} removeLabel={quantity === 1 ? "Remove" : "Remove one"} className="w-36" />
                                <button type="button" onClick={() => setQuantity(product.id, 0)} className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-500" aria-label={`Remove ${product.name} from basket`}>
                                  <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    {suggestion && (
                      <div className="mt-3">
                        <h3 className="font-serif text-lg font-semibold">Forgot something?</h3>
                        <div className="bg-card mt-2 flex items-center gap-3 rounded-xl p-2.5">
                          <ProductImage src={suggestion.image_url} alt="" className="h-12 w-12 shrink-0 rounded-lg" iconClassName="h-5 w-5" />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 break-words text-[15px] font-semibold">{suggestion.name}</p>
                            <p className="text-xs text-[var(--ink-soft)]">{suggestion.unit} · ₹{formatMoney(suggestion.price)}</p>
                          </div>
                          <div className="w-20 shrink-0"><AddButton label={`${t.add} ${suggestion.name}`} onClick={() => setQuantity(suggestion.id, 1)} /></div>
                        </div>
                      </div>
                    )}
                    <section className="mt-4 border-t border-[var(--line)] pt-4" aria-label="Bill details">
                      <h3 className="font-serif text-lg font-semibold">Bill details</h3>
                      <div className="mt-2 flex justify-between text-[15px]"><span>Items ({countLabel})</span><span>₹{formatMoney(total)}</span></div>
                      <div className="mt-2 flex justify-between text-[15px]"><span>{form.fulfilment === "delivery" ? t.delivery : t.pickup}</span><span>{deliveryCharge > 0 ? `₹${formatMoney(deliveryCharge)}` : t.free}</span></div>
                      <div className="mt-3 flex justify-between border-t border-[var(--line)] pt-3 text-xl font-bold"><span>{t.total}</span><span>₹{formatMoney(grandTotal)}</span></div>
                      <p className="mt-2 text-xs text-[var(--ink-soft)]">Final prices shown. No hidden charges.</p>
                    </section>
                  </>
                )}
              </div>
              {basketProducts.length > 0 && (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--paper)]/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
                  <div className="mx-auto max-w-2xl px-4">
                    {remaining > 0 && <p className="mb-2 rounded-lg bg-amber-100 px-3 py-1.5 text-center text-xs font-semibold text-amber-900">{t.minimumRemaining(formatMoney(remaining))}</p>}
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-xs text-[var(--ink-soft)]">{t.total}</p>
                        <p className="text-xl font-bold leading-6">₹{formatMoney(grandTotal)}</p>
                      </div>
                      <button
                        type="button"
                        disabled={remaining > 0}
                        onClick={() => setStep("checkout")}
                        className="bg-brand-deep flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t.checkout} <ArrowRight className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <form onSubmit={submitOrder}>
              <div className="animate-sheet mx-auto flex min-h-full max-w-2xl flex-col px-4 pb-[calc(10.5rem+env(safe-area-inset-bottom))]">
                <div className="flex items-center gap-2 py-3">
                  <button type="button" onClick={() => setStep("basket")} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Back to basket"><ArrowLeft className="h-6 w-6" aria-hidden="true" /></button>
                  <h2 className="font-serif text-2xl font-semibold">{t.checkout}</h2>
                </div>
                <div className="space-y-5">
                  <fieldset>
                    <legend className="sr-only">{t.fulfilmentQuestion}</legend>
                    <div className="grid grid-cols-2 rounded-full border border-stone-300 p-1">
                      <ToggleOption icon={<Truck className="h-5 w-5" aria-hidden="true" />} label={t.delivery} checked={form.fulfilment === "delivery"} onChange={() => setForm({ ...form, fulfilment: "delivery" })} />
                      <ToggleOption icon={<Store className="h-5 w-5" aria-hidden="true" />} label={t.pickup} checked={form.fulfilment === "pickup"} onChange={() => setForm({ ...form, fulfilment: "pickup" })} />
                    </div>
                  </fieldset>

                  <section>
                    <h3 className="mb-2 text-lg font-bold">{form.fulfilment === "delivery" ? "Delivery details" : "Your details"}</h3>
                    <div className="bg-card space-y-4 rounded-xl p-4">
                      <Field label={t.name}><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input !rounded-xl" autoComplete="name" /></Field>
                      <Field label={t.mobile}><input required inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input !rounded-xl" placeholder={t.phoneHint} autoComplete="tel" /></Field>
                      {form.fulfilment === "delivery" && <Field label={t.address}><textarea required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input min-h-20 !rounded-xl" autoComplete="street-address" /></Field>}
                      <Field label={t.notes}><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input min-h-16 !rounded-xl" /></Field>
                    </div>
                  </section>

                  <fieldset>
                    <legend className="mb-2 text-lg font-bold">Payment method</legend>
                    <div className="grid grid-cols-2 gap-3">
                      <PaymentTile icon={<Banknote className="h-6 w-6" aria-hidden="true" />} label={t.cash} checked={form.payment === "cod"} onChange={() => setForm({ ...form, payment: "cod" })} />
                      <PaymentTile icon={<Smartphone className="h-6 w-6" aria-hidden="true" />} label={t.upi} checked={form.payment === "upi_on_delivery"} onChange={() => setForm({ ...form, payment: "upi_on_delivery" })} />
                    </div>
                    <p className="mt-2 text-sm text-[var(--ink-soft)]">{form.payment === "cod" ? "Pay when your order arrives." : "Pay by UPI when your order arrives."}</p>
                  </fieldset>

                  <section>
                    <h3 className="mb-2 text-lg font-bold">Order summary</h3>
                    <div className="flex justify-between text-base text-stone-600"><span>Items ({countLabel})</span><span>₹{formatMoney(total)}</span></div>
                    <div className="mt-2 flex justify-between text-base text-stone-600"><span>{form.fulfilment === "delivery" ? t.delivery : t.pickup}</span><span>{deliveryCharge > 0 ? `₹${formatMoney(deliveryCharge)}` : t.free}</span></div>
                    <div className="mt-3 flex justify-between border-t border-[var(--line)] pt-3 text-xl font-bold"><span>{t.total}</span><span>₹{formatMoney(grandTotal)}</span></div>
                  </section>

                  <label className="flex min-h-11 items-start gap-2.5 text-sm text-stone-700">
                    <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} />
                    <span>{t.agreeToTermsPrefix} <Link href="/terms" target="_blank" className="font-semibold underline">{t.termsWord}</Link> &amp; <Link href="/privacy" target="_blank" className="font-semibold underline">{t.privacyWord}</Link>.</span>
                  </label>
                  {submitError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{submitError}</p>}
                </div>
              </div>
              <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--paper)]/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
                <div className="mx-auto max-w-2xl px-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-xs text-[var(--ink-soft)]">{t.total}</p>
                      <p className="text-xl font-bold leading-6">₹{formatMoney(grandTotal)}</p>
                    </div>
                    <button disabled={submitting} className="bg-brand-deep min-h-12 flex-1 rounded-xl px-5 text-base font-semibold text-white disabled:opacity-60">
                      {submitting ? t.placingOrder : t.placeOrder}
                    </button>
                  </div>
                  <p className="mt-1.5 text-center text-xs text-[var(--ink-soft)]">By placing your order, you confirm these details.</p>
                </div>
              </div>
            </form>
          )}
        </div>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold">{label}</span>{children}</label>;
}

function ToggleOption({ icon, label, checked, onChange }: { icon: React.ReactNode; label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full py-2.5 text-[15px] font-semibold transition ${checked ? "bg-brand-deep text-white" : "text-stone-700"}`}>
      <input type="radio" checked={checked} onChange={onChange} className="sr-only" />
      {icon}
      {label}
    </label>
  );
}

function PaymentTile({ icon, label, checked, onChange }: { icon: React.ReactNode; label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className={`flex min-h-14 cursor-pointer items-center justify-between gap-2 rounded-xl border-[1.5px] px-4 py-3 transition ${checked ? "border-brand bg-white" : "border-[var(--line)] bg-card"}`}>
      <input type="radio" checked={checked} onChange={onChange} className="sr-only" />
      <span className="flex items-center gap-2.5 text-base font-semibold">{icon}{label}</span>
      <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${checked ? "border-brand" : "border-stone-300"}`} aria-hidden="true">
        {checked && <span className="bg-brand h-3 w-3 rounded-full" />}
      </span>
    </label>
  );
}

function ProductCard({ product, quantity, t, onSet, onNotice }: {
  product: Product;
  quantity: number;
  t: typeof copy;
  onSet: (productId: string, quantity: number) => void;
  onNotice: (message: string) => void;
}) {
  return (
    <article className="flex min-w-0 flex-col">
      <ProductImage src={product.image_url} alt={product.name} className={`aspect-[4/3] rounded-xl ${!product.in_stock ? "opacity-60" : ""}`} />
      {/* Name and size stay together; the block always has room for a two-line name, so prices
          and buttons line up across both columns. */}
      <div className="mt-2 min-h-14">
        <h3 className="line-clamp-2 break-words text-sm font-semibold leading-5">{product.name}</h3>
        <p className="truncate text-xs leading-4 text-[var(--ink-soft)]">{product.unit}</p>
      </div>
      <p className="text-base font-bold leading-6">₹{formatMoney(product.price)}</p>
      <div className="mt-1">
        {!product.in_stock ? (
          <AddButton label={`${product.name} is out of stock`} onClick={() => {}} disabled text="Out of stock" />
        ) : quantity === 0 ? (
          <AddButton label={`${t.add} ${product.name}`} onClick={() => onSet(product.id, 1)} />
        ) : (
          <QtyStepper quantity={quantity} name={product.name} onSet={(next) => onSet(product.id, next)} onNotice={onNotice} removeLabel={quantity === 1 ? "Remove" : t.removeOne} />
        )}
      </div>
    </article>
  );
}
