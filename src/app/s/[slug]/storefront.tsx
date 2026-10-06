"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { copy } from "@/lib/copy";
import { CategoryIcon } from "@/lib/category-icons";
import { ArrowLeft, ArrowRight, Banknote, Bike, Check, ClipboardList, Home, LayoutGrid, MapPin, Minus, Plus, Search, SearchX, ShoppingBag, ShoppingCart, Smartphone, Store, Trash2, Truck } from "lucide-react";
import { createPublicClient } from "@/lib/supabase";
import { RegisterServiceWorker } from "./register-service-worker";
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
  const overlayRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => {
    overlayRef.current?.scrollTo({ top: 0 });
  }, [step, checkoutOpen]);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const t = copy;

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
      // Storage can be unavailable (private mode); "Your usuals" simply stays hidden.
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
        if (item.available && item.product_id) next[item.product_id] = (next[item.product_id] ?? 0) + item.qty;
      }
      return next;
    });
    setForm((current) => ({ ...current, phone: repeatPhone }));
    setRepeatAdded(true);
  }

  const basketProducts = products.filter((product) => (quantities[product.id] ?? 0) > 0);
  const deliveryCharge = form.fulfilment === "delivery" ? shop.delivery_fee : 0;
  const grandTotal = total + deliveryCharge;
  const itemLabel = itemCount === 1 ? t.item : t.items;
  const usualProducts = usuals
    .map((usual) => ({ usual, product: products.find((product) => product.id === usual.product_id && product.in_stock) }))
    .filter((entry): entry is { usual: UsualItem; product: Product } => Boolean(entry.product));
  const suggestion = products.find((product) => product.in_stock && !(quantities[product.id] > 0));

  function closeOverlay() {
    setCheckoutOpen(false);
    setStep("basket");
  }

  function buyUsualsAgain() {
    setQuantities((current) => {
      const next = { ...current };
      for (const { usual, product } of usualProducts) next[product.id] = (next[product.id] ?? 0) + usual.qty;
      return next;
    });
  }

  return (
    <main
      className="mx-auto min-h-screen max-w-2xl bg-[var(--paper)] pb-44 text-[var(--ink)] sm:shadow-[0_0_0_1px_var(--line)]"
      data-order-source={source}
      style={{ "--brand": brandColour } as React.CSSProperties}
    >
      <RegisterServiceWorker />
      <header className="px-5 pb-2 pt-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-brand-deep min-w-0 font-serif text-3xl font-semibold leading-tight tracking-tight">{shop.name}</h1>
          <button
            type="button"
            onClick={() => itemCount > 0 && setCheckoutOpen(true)}
            className="bg-card relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            aria-label={`${t.basket}, ${itemCount} ${itemLabel}`}
          >
            <ShoppingCart className="h-5 w-5" aria-hidden="true" />
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[11px] font-bold text-white">{itemCount}</span>
            )}
          </button>
        </div>
        {shop.address && (
          <p className="mt-2 flex items-center gap-1.5 text-[17px] font-semibold">
            <MapPin className="text-brand-deep h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            <span className="truncate">{shop.address}</span>
          </p>
        )}
        <p className="mt-0.5 text-sm text-[var(--ink-soft)]">
          {shop.delivery_fee > 0 ? `₹${formatMoney(shop.delivery_fee)} delivery` : "Free delivery"} <span aria-hidden="true">·</span> Min order ₹{formatMoney(shop.min_order)}
          {deliveredOrderCount >= 5 && <> <span aria-hidden="true">·</span> {t.deliveredOrders(new Intl.NumberFormat("en-IN").format(deliveredOrderCount))}</>}
        </p>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-500" aria-hidden="true" />
          <label className="sr-only" htmlFor="product-search">{t.searchPlaceholder}</label>
          <input
            id="product-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full rounded-full border border-stone-300 bg-transparent py-3 pl-12 pr-4 text-[15px] outline-none placeholder:text-stone-500 focus:border-[var(--brand)] focus:bg-white"
          />
        </div>
      </header>

      {usualProducts.length > 0 && (
        <section className="px-4 pt-4">
          <div className="bg-brand-tint flex items-center justify-between gap-3 overflow-hidden rounded-2xl py-3 pl-4 pr-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-brand-deep whitespace-nowrap font-serif text-xl font-semibold">Your usuals</h2>
              <p className="whitespace-nowrap text-xs text-stone-600">{usualProducts.length} {usualProducts.length === 1 ? t.item : t.items}</p>
            </div>
            <div className="flex -space-x-3" aria-hidden="true">
              {usualProducts.slice(0, 2).map(({ product }) => (
                <span key={product.id} className="h-11 w-11 overflow-hidden rounded-full bg-white ring-2 ring-white">
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-brand-deep flex h-full w-full items-center justify-center text-lg font-black">{product.name.slice(0, 1)}</span>
                  )}
                </span>
              ))}
            </div>
            <button type="button" onClick={buyUsualsAgain} className="text-brand-deep flex shrink-0 items-center gap-1 text-sm font-bold">
              Buy again <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      <section className="px-4 pt-3">
        <details className="rounded-2xl bg-card px-4 py-3 text-sm">
          <summary className="cursor-pointer font-semibold">{t.repeatTitle}</summary>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">{t.repeatPrompt}</p>
          <form onSubmit={checkRepeatOrder} className="mt-3 flex gap-2">
            <label className="sr-only" htmlFor="repeat-phone">{t.mobile}</label>
            <input id="repeat-phone" required inputMode="tel" value={repeatPhone} onChange={(e) => setRepeatPhone(e.target.value)} placeholder={t.phoneHint} className="input flex-1 !rounded-xl" />
            <button disabled={repeatStatus === "loading"} className="bg-brand-deep shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
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
                      <div>
                        <p className="font-semibold">{item.qty} × {displayLabel}</p>
                        {!item.available && <p className="text-xs font-semibold text-red-700">{t.repeatUnavailable}</p>}
                        {priceChanged && <p className="text-xs font-semibold text-amber-700">{t.repeatPriceChanged(formatMoney(Number(item.price_paid)), formatMoney(Number(item.current_price)))}</p>}
                      </div>
                      <p className="font-bold">{item.available ? `₹${formatMoney(Number(item.current_price))}` : "—"}</p>
                    </li>
                  );
                })}
              </ul>
              <button type="button" onClick={addRepeatItemsToBasket} className="bg-brand-deep mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white">
                {t.repeatAddAll}
              </button>
              {repeatAdded && <p className="mt-2 text-sm font-semibold text-emerald-700">{t.repeatAdded}</p>}
            </div>
          )}
        </details>
      </section>

      <section className="sticky top-0 z-10 bg-[var(--paper)]/95 px-4 pb-2 pt-4 backdrop-blur-md">
        <div className="no-scrollbar -mx-4 flex gap-5 overflow-x-auto px-4 pb-1" aria-label="Product categories">
          <CategoryTile active={categoryId === "all"} onClick={() => setCategoryId("all")} label={t.allCategories} icon={null} initial={false} />
          {categories.map((category) => (
            <CategoryTile
              key={category.id}
              active={categoryId === category.id}
              onClick={() => setCategoryId(category.id)}
              label={category.name}
              icon={category.icon}
            />
          ))}
        </div>
      </section>

      <section className="px-4 pt-3">
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-4 py-12 text-center">
            <SearchX className="h-7 w-7 text-[var(--ink-soft)]" aria-hidden="true" />
            <p className="text-sm text-[var(--ink-soft)]">{t.emptySearch}</p>
          </div>
        ) : (
          sections ? (
            <div className="space-y-7">
              {sections.map((section) => (
                <div key={section.key}>
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h2 className="font-serif text-2xl font-semibold tracking-tight">{section.label}</h2>
                    {section.key !== "uncategorised" && (
                      <button type="button" onClick={() => setCategoryId(section.key)} className="text-brand-deep text-sm font-semibold">See all</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
                    {section.items.map((product) => (
                      <ProductCard key={product.id} product={product} quantity={quantities[product.id] ?? 0} t={t} onChangeQuantity={changeQuantity} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} quantity={quantities[product.id] ?? 0} t={t} onChangeQuantity={changeQuantity} />
              ))}
            </div>
          )
        )}
      </section>

      <footer className="mt-10 px-5 pb-6 pt-6 text-xs text-[var(--ink-soft)]">
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--line)] pt-5">
          <Link href="/terms" className="underline decoration-[var(--line)] underline-offset-4">{t.termsWord}</Link>
          <Link href="/privacy" className="underline decoration-[var(--line)] underline-offset-4">{t.privacyWord}</Link>
          <Link href="/refund-policy" className="underline decoration-[var(--line)] underline-offset-4">Refund &amp; cancellation policy</Link>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-2xl" style={{ "--brand": brandColour } as React.CSSProperties}>
        {itemCount > 0 && (
          <div className="animate-slide-up px-3 pb-2">
            {remaining > 0 && (
              <p className="mx-2 -mb-2 rounded-t-xl bg-amber-100 px-4 pb-3 pt-1.5 text-center text-xs font-semibold text-amber-900">
                {t.minimumRemaining(formatMoney(remaining))}
              </p>
            )}
            <button
              type="button"
              onClick={() => setCheckoutOpen(true)}
              className="bg-brand-deep relative flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3.5 text-left text-white shadow-[0_10px_28px_-8px_rgba(0,0,0,0.5)]"
            >
              <span className="flex items-center gap-3 text-sm font-semibold">
                <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                {itemCount} {itemLabel} <span aria-hidden="true">·</span> ₹{formatMoney(total)}
              </span>
              <span className="flex items-center gap-1.5 text-sm font-bold">
                {t.openBasket}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </button>
          </div>
        )}
        <nav className="flex border-t border-[var(--line)] bg-[var(--paper)]/95 backdrop-blur-md" aria-label="Main">
          <span className="text-brand-deep flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold" aria-current="page">
            <Home className="h-5 w-5" aria-hidden="true" />
            Home
          </span>
          <Link href={`/s/${shop.slug}/status`} className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-stone-500">
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
            Orders
          </Link>
        </nav>
      </div>

      {checkoutOpen && (
        <div ref={overlayRef} className="fixed inset-0 z-30 overflow-y-auto bg-[var(--paper)]" role="dialog" aria-modal="true" aria-label={step === "basket" ? "Your basket" : "Checkout"} style={{ "--brand": brandColour } as React.CSSProperties}>
          <div className="animate-sheet mx-auto flex min-h-full max-w-2xl flex-col px-4 pb-6">
            {orderCode ? (
              <div className="my-auto py-16 text-center">
                <span className="bg-brand-tint text-brand-deep mx-auto flex h-16 w-16 items-center justify-center rounded-full">
                  <Check className="h-8 w-8" aria-hidden="true" />
                </span>
                <p className="mt-4 text-sm font-bold text-emerald-700">{t.orderPlaced}</p>
                <h2 className="mt-1 font-serif text-2xl font-semibold">{t.orderCode}</h2>
                <p className="bg-brand-soft text-brand-deep mx-auto mt-4 inline-block rounded-2xl px-6 py-3 text-4xl font-black tracking-[0.18em]">{orderCode}</p>
                <p className="mt-4 text-sm text-[var(--ink-soft)]">{t.keepCode}</p>
                <a href={`/s/${shop.slug}/status?code=${orderCode}`} className="bg-brand-deep mt-6 inline-block rounded-xl px-6 py-3.5 font-semibold text-white">{t.checkStatus}</a>
              </div>
            ) : step === "basket" ? (
              <>
                <div className="flex items-center gap-4 py-5">
                  <button type="button" onClick={closeOverlay} className="flex h-10 w-10 items-center justify-center rounded-full" aria-label={t.close}><ArrowLeft className="h-6 w-6" aria-hidden="true" /></button>
                  <div>
                    <h2 className="font-serif text-2xl font-semibold leading-tight">Your basket</h2>
                    <p className="text-sm text-[var(--ink-soft)]">{itemCount} {itemLabel}</p>
                  </div>
                </div>
                {basketProducts.length === 0 ? (
                  <p className="py-16 text-center text-sm text-[var(--ink-soft)]">Your basket is empty.</p>
                ) : (
                  <>
                    <div className="bg-card flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-[15px]">
                      <span className="flex items-center gap-2.5">
                        {form.fulfilment === "delivery" ? <Bike className="h-5 w-5" aria-hidden="true" /> : <Store className="h-5 w-5" aria-hidden="true" />}
                        {form.fulfilment === "delivery" ? `${t.delivery} · ${shop.delivery_fee > 0 ? `₹${formatMoney(shop.delivery_fee)}` : t.free}` : `${t.pickup} · ${t.free}`}
                      </span>
                      <button type="button" onClick={() => setForm({ ...form, fulfilment: form.fulfilment === "delivery" ? "pickup" : "delivery" })} className="text-brand-deep text-sm font-bold">Change</button>
                    </div>
                    <ul className="mt-2 divide-y divide-[var(--line)]">
                      {basketProducts.map((product) => (
                        <li key={product.id} className="flex gap-4 py-4">
                          <div className="bg-card h-28 w-28 shrink-0 overflow-hidden rounded-xl">
                            {product.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-brand-deep flex h-full w-full items-center justify-center text-3xl font-black opacity-40" aria-hidden="true">{product.name.slice(0, 1)}</span>
                            )}
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h3 className="text-base font-semibold leading-snug">{product.name}</h3>
                                <p className="text-sm text-[var(--ink-soft)]">{product.unit}</p>
                              </div>
                              <button type="button" onClick={() => changeQuantity(product.id, -(quantities[product.id] ?? 0))} className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-500" aria-label={`Remove ${product.name}`}><Trash2 className="h-[18px] w-[18px]" aria-hidden="true" /></button>
                            </div>
                            <div className="mt-auto flex items-end justify-between pt-2">
                              <p className="text-xl font-bold">₹{formatMoney(product.price * (quantities[product.id] ?? 0))}</p>
                              <Stepper quantity={quantities[product.id] ?? 0} name={product.name} t={t} onChangeQuantity={(delta) => changeQuantity(product.id, delta)} />
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {suggestion && (
                      <div className="mt-2">
                        <h3 className="font-serif text-xl font-semibold">Forgot something?</h3>
                        <div className="bg-card mt-3 flex items-center gap-3 rounded-xl p-3">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white">
                            {suggestion.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={suggestion.image_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-brand-deep flex h-full w-full items-center justify-center text-xl font-black opacity-40" aria-hidden="true">{suggestion.name.slice(0, 1)}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold">{suggestion.name} <span className="font-normal text-[var(--ink-soft)]">· {suggestion.unit}</span></p>
                            <p className="mt-0.5 text-base font-bold">₹{formatMoney(suggestion.price)}</p>
                          </div>
                          <button type="button" onClick={() => changeQuantity(suggestion.id, 1)} className="bg-brand-deep shrink-0 rounded-lg px-5 py-2.5 text-sm font-semibold text-white" aria-label={`${t.add} ${suggestion.name}`}>{t.add}</button>
                        </div>
                      </div>
                    )}
                    <div className="mt-4 border-t border-[var(--line)] pt-4">
                      <div className="flex justify-between text-base"><span>Items</span><span>₹{formatMoney(total)}</span></div>
                      <div className="mt-3 flex justify-between text-base"><span>{t.delivery}</span><span>{deliveryCharge > 0 ? `₹${formatMoney(deliveryCharge)}` : t.free}</span></div>
                      <div className="mt-4 flex justify-between border-t border-[var(--line)] pt-4 text-2xl font-bold"><span>{t.total}</span><span>₹{formatMoney(grandTotal)}</span></div>
                      <p className="mt-3 text-center text-xs text-[var(--ink-soft)]">Final prices shown. No hidden charges.</p>
                    </div>
                    {remaining > 0 && <p className="mt-3 rounded-xl bg-amber-100 px-4 py-2.5 text-center text-sm font-semibold text-amber-900">{t.minimumRemaining(formatMoney(remaining))}</p>}
                    <button
                      type="button"
                      disabled={remaining > 0}
                      onClick={() => setStep("checkout")}
                      className="bg-brand-deep mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t.checkout} · ₹{formatMoney(grandTotal)} <ArrowRight className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-4 py-5">
                  <button type="button" onClick={() => setStep("basket")} className="flex h-10 w-10 items-center justify-center rounded-full" aria-label="Back to basket"><ArrowLeft className="h-6 w-6" aria-hidden="true" /></button>
                  <h2 className="font-serif text-2xl font-semibold">{t.checkout}</h2>
                </div>
                <form onSubmit={submitOrder} className="space-y-5">
                  <fieldset>
                    <legend className="sr-only">{t.fulfilmentQuestion}</legend>
                    <div className="grid grid-cols-2 rounded-full border border-stone-300 p-1">
                      <ToggleOption icon={<Truck className="h-5 w-5" aria-hidden="true" />} label={t.delivery} checked={form.fulfilment === "delivery"} onChange={() => setForm({ ...form, fulfilment: "delivery" })} />
                      <ToggleOption icon={<Store className="h-5 w-5" aria-hidden="true" />} label={t.pickup} checked={form.fulfilment === "pickup"} onChange={() => setForm({ ...form, fulfilment: "pickup" })} />
                    </div>
                  </fieldset>

                  <section>
                    <h3 className="mb-3 text-xl font-bold">{form.fulfilment === "delivery" ? "Delivery details" : "Your details"}</h3>
                    <div className="bg-card space-y-4 rounded-xl p-4">
                      <Field label={t.name}><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input !rounded-xl" autoComplete="name" /></Field>
                      <Field label={t.mobile}><input required inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input !rounded-xl" placeholder={t.phoneHint} autoComplete="tel" /></Field>
                      {form.fulfilment === "delivery" && <Field label={t.address}><textarea required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input min-h-20 !rounded-xl" autoComplete="street-address" /></Field>}
                      <Field label={t.notes}><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input min-h-16 !rounded-xl" /></Field>
                    </div>
                  </section>

                  <fieldset>
                    <legend className="mb-3 text-xl font-bold">Payment method</legend>
                    <div className="grid grid-cols-2 gap-3">
                      <PaymentTile icon={<Banknote className="h-6 w-6" aria-hidden="true" />} label={t.cash} checked={form.payment === "cod"} onChange={() => setForm({ ...form, payment: "cod" })} />
                      <PaymentTile icon={<Smartphone className="h-6 w-6" aria-hidden="true" />} label={t.upi} checked={form.payment === "upi_on_delivery"} onChange={() => setForm({ ...form, payment: "upi_on_delivery" })} />
                    </div>
                    <p className="mt-2 text-sm text-[var(--ink-soft)]">{form.payment === "cod" ? "Pay when your order arrives." : "Pay by UPI when your order arrives."}</p>
                  </fieldset>

                  <section>
                    <h3 className="mb-3 text-xl font-bold">Order summary</h3>
                    <div className="flex justify-between text-base text-stone-600"><span>Items ({itemCount})</span><span>₹{formatMoney(total)}</span></div>
                    <div className="mt-2 flex justify-between text-base text-stone-600"><span>{t.delivery}</span><span>{deliveryCharge > 0 ? `₹${formatMoney(deliveryCharge)}` : t.free}</span></div>
                    <div className="mt-3 flex justify-between border-t border-[var(--line)] pt-3 text-2xl font-bold"><span>{t.total}</span><span>₹{formatMoney(grandTotal)}</span></div>
                  </section>

                  <label className="flex items-start gap-2.5 text-sm text-stone-700">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--brand)]" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} />
                    <span>{t.agreeToTermsPrefix} <Link href="/terms" target="_blank" className="font-semibold underline">{t.termsWord}</Link> &amp; <Link href="/privacy" target="_blank" className="font-semibold underline">{t.privacyWord}</Link>.</span>
                  </label>
                  {submitError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{submitError}</p>}
                  <div>
                    <button disabled={submitting} className="bg-brand-deep w-full rounded-xl px-5 py-4 text-base font-semibold text-white disabled:opacity-60">
                      {submitting ? t.placingOrder : `${t.placeOrder} · ₹${formatMoney(grandTotal)}`}
                    </button>
                    <p className="mt-3 text-center text-sm text-[var(--ink-soft)]">By placing your order, you confirm these details.</p>
                  </div>
                </form>
              </>
            )}
          </div>
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
    <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-full py-3 text-[15px] font-semibold transition ${checked ? "bg-brand-deep text-white" : "text-stone-700"}`}>
      <input type="radio" checked={checked} onChange={onChange} className="sr-only" />
      {icon}
      {label}
    </label>
  );
}

function PaymentTile({ icon, label, checked, onChange }: { icon: React.ReactNode; label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border-[1.5px] px-4 py-4 transition ${checked ? "border-brand bg-white" : "border-[var(--line)] bg-card"}`}>
      <input type="radio" checked={checked} onChange={onChange} className="sr-only" />
      <span className="flex items-center gap-2.5 text-base font-semibold">{icon}{label}</span>
      <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${checked ? "border-brand" : "border-stone-300"}`} aria-hidden="true">
        {checked && <span className="bg-brand h-3 w-3 rounded-full" />}
      </span>
    </label>
  );
}

function CategoryTile({ active, onClick, label, icon, initial = true }: { active: boolean; onClick: () => void; label: string; icon: string | null; initial?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="flex shrink-0 flex-col items-center gap-1.5">
      <span className={`flex h-14 w-14 items-center justify-center rounded-full ${active ? "bg-brand-tint text-brand-deep" : "bg-card text-stone-600"}`}>
        {icon ? <CategoryIcon icon={icon} className="h-6 w-6" /> : initial ? <span className="font-serif text-xl font-semibold" aria-hidden="true">{label.slice(0, 1).toUpperCase()}</span> : <LayoutGrid className="h-6 w-6" aria-hidden="true" />}
      </span>
      <span className={`border-b-2 pb-0.5 text-sm ${active ? "text-brand-deep border-brand font-bold" : "border-transparent font-medium text-stone-600"}`}>{label}</span>
    </button>
  );
}

function Stepper({ quantity, name, t, onChangeQuantity }: { quantity: number; name: string; t: typeof copy; onChangeQuantity: (delta: number) => void }) {
  return (
    <div className="border-brand text-brand-deep flex items-center rounded-lg border-[1.5px] bg-white" aria-label={`${name} quantity`}>
      <button type="button" className="flex h-9 w-9 items-center justify-center" onClick={() => onChangeQuantity(-1)} aria-label={`${t.removeOne} ${name}`}><Minus className="h-4 w-4" aria-hidden="true" /></button>
      <span className="min-w-7 text-center text-sm font-bold" aria-live="polite">{quantity}</span>
      <button type="button" className="flex h-9 w-9 items-center justify-center" onClick={() => onChangeQuantity(1)} aria-label={`${t.addOne} ${name}`}><Plus className="h-4 w-4" aria-hidden="true" /></button>
    </div>
  );
}

function ProductCard({ product, quantity, t, onChangeQuantity }: {
  product: Product;
  quantity: number;
  t: typeof copy;
  onChangeQuantity: (productId: string, delta: number) => void;
}) {
  return (
    <article className={`flex flex-col ${!product.in_stock ? "opacity-70" : ""}`}>
      <div className="bg-card relative aspect-[4/3] overflow-hidden rounded-xl">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="text-brand-deep flex h-full w-full items-center justify-center text-5xl font-black opacity-40" aria-hidden="true">
            {product.name.slice(0, 1)}
          </div>
        )}
        {!product.in_stock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-bold text-white">Out of stock</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col pt-2.5">
        <h3 className="text-[15px] font-semibold leading-snug">{product.name}</h3>
        <p className="mt-0.5 text-sm text-[var(--ink-soft)]">{product.unit}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
          <p className="text-lg font-bold">₹{formatMoney(product.price)}</p>
          {product.in_stock && (quantity === 0 ? (
            <button
              type="button"
              onClick={() => onChangeQuantity(product.id, 1)}
              className="bg-brand-deep rounded-lg px-5 py-2 text-sm font-semibold text-white"
              aria-label={`${t.add} ${product.name}`}
            >
              {t.add}
            </button>
          ) : (
            <Stepper quantity={quantity} name={product.name} t={t} onChangeQuantity={(delta) => onChangeQuantity(product.id, delta)} />
          ))}
        </div>
      </div>
    </article>
  );
}
