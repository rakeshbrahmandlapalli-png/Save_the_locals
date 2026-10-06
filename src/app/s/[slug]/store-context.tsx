"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { aisleAccent, deriveCollections, slugify, type Accent, type Collection } from "@/lib/collections";
import { MAX_QTY } from "./quantity-controls";
import type { Category, Product, Shop } from "./page";

/** A screen layered over the home page. Encoded in the URL so back, reload and links work. */
export type Layer = { kind: "category"; id: string } | { kind: "collection"; id: string } | { kind: "basket" } | { kind: "checkout" };

export type Aisle = Category & { slug: string; accent: Accent; productIds: string[] };
export type UsualItem = { product_id: string; qty: number };
export type CheckoutForm = { name: string; phone: string; address: string; notes: string; payment: "cod" | "upi_on_delivery" };

type Quantities = Record<string, number>;

type StoreValue = {
  shop: Shop;
  brandColour: string;
  aisles: Aisle[];
  products: Product[];
  productById: Map<string, Product>;
  aisleOf: (product: Product) => Aisle | undefined;
  collections: Collection[];
  source: string;
  quantities: Quantities;
  setQuantity: (productId: string, quantity: number) => void;
  addItems: (items: { productId: string; qty: number }[]) => void;
  clearBasket: () => void;
  basketProducts: Product[];
  units: number;
  productCount: number;
  subtotal: number;
  remaining: number;
  fulfilment: "delivery" | "pickup";
  setFulfilment: (value: "delivery" | "pickup") => void;
  deliveryCharge: number;
  total: number;
  form: CheckoutForm;
  setForm: React.Dispatch<React.SetStateAction<CheckoutForm>>;
  usuals: UsualItem[];
  /** False until this device's last order has been read, so "Buy again" doesn't flash the wrong state. */
  usualsReady: boolean;
  rememberOrder: (items: UsualItem[]) => void;
  stack: Layer[];
  open: (layer: Layer) => void;
  back: () => void;
  goHome: () => void;
  notice: string;
  notify: (message: string) => void;
  announce: (message: string) => void;
  bumpKey: number;
  typing: boolean;
};

const StoreContext = createContext<StoreValue | null>(null);

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
}

export function plural(count: number, one: string, many: string) {
  return `${new Intl.NumberFormat("en-IN").format(count)} ${count === 1 ? one : many}`;
}

function stackFromParams(params: URLSearchParams, aisles: Aisle[], collections: Collection[]): Layer[] {
  const stack: Layer[] = [];
  const aisleSlug = params.get("c");
  const collectionId = params.get("k");
  if (aisleSlug) {
    const aisle = aisles.find((item) => item.slug === aisleSlug);
    if (aisle) stack.push({ kind: "category", id: aisle.id });
  } else if (collectionId && (collectionId === "all" || collections.some((item) => item.id === collectionId))) {
    stack.push({ kind: "collection", id: collectionId });
  }
  const view = params.get("v");
  if (view === "basket" || view === "checkout") stack.push({ kind: "basket" });
  if (view === "checkout") stack.push({ kind: "checkout" });
  return stack;
}

function urlForStack(pathname: string, stack: Layer[], aisles: Aisle[]) {
  const params = new URLSearchParams();
  for (const layer of stack) {
    if (layer.kind === "category") params.set("c", aisles.find((aisle) => aisle.id === layer.id)?.slug ?? "");
    if (layer.kind === "collection") params.set("k", layer.id);
  }
  if (stack.some((layer) => layer.kind === "checkout")) params.set("v", "checkout");
  else if (stack.some((layer) => layer.kind === "basket")) params.set("v", "basket");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function StoreProvider({
  shop,
  categories,
  products,
  initialSource,
  children,
}: {
  shop: Shop;
  categories: Category[];
  products: Product[];
  initialSource: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const brandColour = shop.brand?.primary_colour || "#285943";

  const aisles = useMemo<Aisle[]>(() => {
    const used = new Set<string>();
    return categories.map((category, index) => {
      let slug = slugify(category.name);
      while (used.has(slug)) slug = `${slug}-${index}`;
      used.add(slug);
      return { ...category, slug, accent: aisleAccent(index), productIds: products.filter((product) => product.category_id === category.id).map((product) => product.id) };
    });
  }, [categories, products]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const aisleById = useMemo(() => new Map(aisles.map((aisle) => [aisle.id, aisle])), [aisles]);
  const collections = useMemo(() => deriveCollections(products), [products]);
  const aisleOf = useCallback((product: Product) => (product.category_id ? aisleById.get(product.category_id) : undefined), [aisleById]);

  const stack = useMemo(() => stackFromParams(new URLSearchParams(searchParams.toString()), aisles, collections), [searchParams, aisles, collections]);
  // Pushes made in this session; if the visitor arrived on a deep link, "back" moves up a layer instead of leaving the shop.
  const pushes = useRef(0);

  const navigate = useCallback((next: Layer[], replace = false) => {
    const url = urlForStack(pathname, next, aisles);
    if (replace) window.history.replaceState(null, "", url);
    else {
      pushes.current += 1;
      window.history.pushState(null, "", url);
    }
  }, [pathname, aisles]);

  const open = useCallback((layer: Layer) => {
    const base = stack.filter((item) => item.kind === "category" || item.kind === "collection");
    if (layer.kind === "category" || layer.kind === "collection") navigate([layer]);
    else if (layer.kind === "basket") navigate([...base, { kind: "basket" }]);
    else navigate([...base, { kind: "basket" }, { kind: "checkout" }]);
  }, [stack, navigate]);

  const back = useCallback(() => {
    if (pushes.current > 0) {
      window.history.back(); // the popstate listener updates the push count
    } else {
      navigate(stack.slice(0, -1), true);
    }
  }, [stack, navigate]);

  const goHome = useCallback(() => navigate([]), [navigate]);

  useEffect(() => {
    const onPop = () => {
      pushes.current = Math.max(0, pushes.current - 1);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Keep the page behind a layer still; its scroll position is untouched while a layer is open.
  useEffect(() => {
    if (stack.length === 0) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [stack.length]);

  const [source, setSource] = useState("direct");
  useEffect(() => {
    const key = `stl-source:${shop.slug}`;
    if (initialSource) {
      sessionStorage.setItem(key, initialSource);
      setSource(initialSource);
    } else {
      setSource(sessionStorage.getItem(key) || "direct");
    }
  }, [initialSource, shop.slug]);

  // Basket survives reloads and back/forward within the session.
  const [quantities, setQuantities] = useState<Quantities>({});
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(`stl-cart:${shop.slug}`) ?? "{}") as Record<string, unknown>;
      const restored: Quantities = {};
      for (const [id, qty] of Object.entries(saved)) {
        const product = productById.get(id);
        const value = Math.min(MAX_QTY, Math.floor(Number(qty)));
        if (product?.in_stock && value > 0) restored[id] = value;
      }
      setQuantities(restored);
    } catch {
      // Storage unavailable: start with an empty basket.
    }
    loaded.current = true;
  }, [shop.slug, productById]);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      sessionStorage.setItem(`stl-cart:${shop.slug}`, JSON.stringify(quantities));
    } catch {
      // Not critical.
    }
  }, [quantities, shop.slug]);

  const [bumpKey, setBumpKey] = useState(0);
  const [liveMessage, setLiveMessage] = useState("");
  const announce = useCallback((message: string) => setLiveMessage(message), []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    const next = Math.min(MAX_QTY, Math.max(0, Math.floor(quantity)));
    setQuantities((current) => {
      if (next === 0) {
        const { [productId]: _removed, ...rest } = current;
        void _removed;
        return rest;
      }
      return { ...current, [productId]: next };
    });
    setBumpKey((key) => key + 1);
    const name = productById.get(productId)?.name ?? "Item";
    setLiveMessage(next === 0 ? `${name} removed from basket` : `${name}: ${next} in basket`);
  }, [productById]);

  const addItems = useCallback((items: { productId: string; qty: number }[]) => {
    setQuantities((current) => {
      const next = { ...current };
      for (const { productId, qty } of items) {
        if (productById.get(productId)?.in_stock) next[productId] = Math.min(MAX_QTY, (next[productId] ?? 0) + qty);
      }
      return next;
    });
    setBumpKey((key) => key + 1);
    setLiveMessage(`${plural(items.length, "product", "products")} added to basket`);
  }, [productById]);

  const clearBasket = useCallback(() => setQuantities({}), []);

  const [fulfilment, setFulfilment] = useState<"delivery" | "pickup">("delivery");
  const [form, setForm] = useState<CheckoutForm>({ name: "", phone: "", address: "", notes: "", payment: "cod" });

  const [usuals, setUsuals] = useState<UsualItem[]>([]);
  const [usualsReady, setUsualsReady] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`stl-usuals:${shop.slug}`) ?? "[]");
      if (Array.isArray(saved)) setUsuals(saved.filter((item): item is UsualItem => typeof item?.product_id === "string" && Number(item?.qty) > 0));
    } catch {
      // Storage can be unavailable (private mode); "Buy again" then relies on the mobile-number lookup.
    }
    setUsualsReady(true);
  }, [shop.slug]);
  const rememberOrder = useCallback((items: UsualItem[]) => {
    setUsuals(items);
    try {
      localStorage.setItem(`stl-usuals:${shop.slug}`, JSON.stringify(items));
    } catch {
      // Not critical: the order is already placed.
    }
  }, [shop.slug]);

  const [notice, setNotice] = useState("");
  const notify = useCallback((message: string) => setNotice(message), []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // On touch devices, hide fixed bottom bars while the on-screen keyboard is likely open.
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    const isTextField = (target: EventTarget | null) =>
      target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit"].includes(target.type));
    const onIn = (event: FocusEvent) => coarse.matches && isTextField(event.target) && setTyping(true);
    const onOut = (event: FocusEvent) => isTextField(event.target) && setTyping(false);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);

  const basketProducts = useMemo(() => products.filter((product) => (quantities[product.id] ?? 0) > 0), [products, quantities]);
  const units = basketProducts.reduce((sum, product) => sum + (quantities[product.id] ?? 0), 0);
  const subtotal = basketProducts.reduce((sum, product) => sum + product.price * (quantities[product.id] ?? 0), 0);
  const remaining = Math.max(0, shop.min_order - subtotal);
  const deliveryCharge = fulfilment === "delivery" ? shop.delivery_fee : 0;

  const value: StoreValue = {
    shop,
    brandColour,
    aisles,
    products,
    productById,
    aisleOf,
    collections,
    source,
    quantities,
    setQuantity,
    addItems,
    clearBasket,
    basketProducts,
    units,
    productCount: basketProducts.length,
    subtotal,
    remaining,
    fulfilment,
    setFulfilment,
    deliveryCharge,
    total: subtotal + deliveryCharge,
    form,
    setForm,
    usuals,
    usualsReady,
    rememberOrder,
    stack,
    open,
    back,
    goHome,
    notice,
    notify,
    announce,
    bumpKey,
    typing,
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
      <p className="sr-only" aria-live="polite">{liveMessage}</p>
    </StoreContext.Provider>
  );
}
