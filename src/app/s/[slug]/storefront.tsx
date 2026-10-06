"use client";

import { ArrowRight, ShoppingBasket } from "lucide-react";
import { BasketView, countLine } from "./basket-view";
import { BottomNav } from "./bottom-nav";
import { BrowseView } from "./browse-view";
import { CheckoutView } from "./checkout-view";
import { HomeView } from "./home-view";
import { RegisterServiceWorker } from "./register-service-worker";
import { StoreProvider, formatMoney, useStore } from "./store-context";
import type { Category, Product, Shop } from "./page";

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
  return (
    <StoreProvider shop={shop} categories={categories} products={products} initialSource={initialSource}>
      <Shell deliveredOrderCount={deliveredOrderCount} />
    </StoreProvider>
  );
}

function Shell({ deliveredOrderCount }: { deliveredOrderCount: number }) {
  const { brandColour, stack, units } = useStore();
  const top = stack[stack.length - 1];
  const showBottomArea = !top || top.kind === "category" || top.kind === "collection";

  return (
    <div className="min-h-screen bg-[var(--ivory)] text-[var(--ink)]" style={{ "--brand": brandColour } as React.CSSProperties}>
      <RegisterServiceWorker />
      {/* The home page stays mounted underneath every layer, so its scroll position and search survive. */}
      <div className={units > 0 ? "pb-[calc(8.5rem+env(safe-area-inset-bottom))]" : "pb-[calc(4.5rem+env(safe-area-inset-bottom))]"} aria-hidden={stack.length > 0 || undefined} inert={stack.length > 0 || undefined}>
        <HomeView deliveredOrderCount={deliveredOrderCount} />
      </div>
      {stack.map((layer, depth) => {
        const covered = depth < stack.length - 1;
        const props = { "aria-hidden": covered || undefined, inert: covered || undefined } as const;
        if (layer.kind === "category" || layer.kind === "collection") return <div key={`${layer.kind}:${layer.id}`} {...props}><BrowseView layer={layer} depth={depth} /></div>;
        if (layer.kind === "basket") return <div key="basket" {...props}><BasketView depth={depth} /></div>;
        return <div key="checkout" {...props}><CheckoutView depth={depth} /></div>;
      })}
      {showBottomArea && <BottomArea />}
      <Toast />
    </div>
  );
}

function BottomArea() {
  const { shop, units, productCount, subtotal, open, stack, goHome, typing, bumpKey } = useStore();
  if (typing) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      {units > 0 && (
        <div className="mx-auto max-w-[1120px] px-3 pb-2 sm:px-6">
          <button type="button" onClick={() => open({ kind: "basket" })} className="btn-primary animate-slide-up min-h-14 w-full justify-between px-4 text-left">
            <span className="flex min-w-0 items-center gap-3">
              <span key={bumpKey} className="animate-bump flex"><ShoppingBasket className="h-5 w-5 shrink-0" aria-hidden="true" /></span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium leading-4 text-white/80">{countLine(productCount, units)}</span>
                <span className="block text-base font-bold leading-6">₹{formatMoney(subtotal)}</span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-sm font-bold">View basket <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
          </button>
        </div>
      )}
      <BottomNav slug={shop.slug} active="home" onHome={stack.length > 0 ? goHome : () => window.scrollTo({ top: 0, behavior: "smooth" })} />
    </div>
  );
}

function Toast() {
  const { notice } = useStore();
  if (!notice) return null;
  return (
    <p role="status" className="fixed inset-x-4 bottom-[calc(9rem+env(safe-area-inset-bottom))] z-[90] mx-auto w-fit max-w-[calc(100%-2rem)] rounded-lg bg-[var(--ink)] px-4 py-2.5 text-center text-sm font-medium text-white">
      {notice}
    </p>
  );
}
