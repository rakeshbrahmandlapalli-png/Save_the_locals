"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, PackageCheck, Phone, Search, XCircle } from "lucide-react";
import { createPublicClient } from "@/lib/supabase";
import { statusCopy as t } from "@/lib/copy";
import { BottomNav } from "../bottom-nav";

type StatusResult = { order_code: string; status: string; fulfilment: string; total: number; created_at: string };
type ShopInfo = { name: string; phone: string | null; brand: { primary_colour?: string } | null };

type Step = { key: string; label: string };

// Delivery and pickup share the first two stages; only delivery has an "out for delivery" stage.
const DELIVERY_STEPS: Step[] = [
  { key: "new", label: "Order placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
];
const PICKUP_STEPS: Step[] = [
  { key: "new", label: "Order placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "delivered", label: "Collected" },
];

function headline(status: string, fulfilment: string) {
  const pickup = fulfilment === "pickup";
  switch (status) {
    case "new": return { title: "Order placed", detail: "The shop has your order and will confirm it shortly." };
    case "confirmed": return { title: "Confirmed", detail: pickup ? "The shop is getting your order ready." : "The shop is getting your order ready for delivery." };
    case "out_for_delivery": return { title: "Out for delivery", detail: "Your order is on its way." };
    case "delivered": return { title: pickup ? "Collected" : "Delivered", detail: pickup ? "Thanks for collecting your order." : "Your order has been delivered." };
    case "cancelled": return { title: "Cancelled", detail: "This order was cancelled. Contact the shop if you have questions." };
    default: return { title: status.replace(/_/g, " "), detail: "" };
  }
}

export default function OrderStatusPage() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearchParams();
  const [code, setCode] = useState(search.get("code") || "");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<StatusResult | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(true);
  const [shop, setShop] = useState<ShopInfo | null>(null);

  // Shop name, phone and brand colour are public (the storefront reads them too).
  useEffect(() => {
    let cancelled = false;
    createPublicClient()
      .from("shops")
      .select("name,phone,brand")
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle<ShopInfo>()
      .then(({ data }) => {
        if (!cancelled && data) setShop(data);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function check(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      // Same access check as before: the order code and the customer's mobile number must both match.
      const { data, error } = await createPublicClient().rpc("order_status", { shop_slug: slug, code: code.trim(), phone });
      const row = (data as StatusResult[] | null)?.[0];
      if (error || !row) {
        setResult(null);
        setFormOpen(true);
        setMessage(error?.message || t.notFound);
        return;
      }
      setResult(row);
      setFormOpen(false);
    } catch {
      setResult(null);
      setFormOpen(true);
      setMessage("We couldn't reach the shop. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const brandColour = shop?.brand?.primary_colour || "#285943";
  const steps = result?.fulfilment === "pickup" ? PICKUP_STEPS : DELIVERY_STEPS;
  const summary = result ? headline(result.status, result.fulfilment) : null;

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-[var(--paper)] px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-3 text-[var(--ink)]" style={{ "--brand": brandColour } as React.CSSProperties}>
      <div className="flex items-center gap-2">
        <Link href={`/s/${slug}`} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label={t.back}><ArrowLeft className="h-6 w-6" aria-hidden="true" /></Link>
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-semibold leading-tight">{t.title}</h1>
          {shop && <p className="truncate text-sm text-[var(--ink-soft)]">{shop.name}</p>}
        </div>
      </div>

      {result && !formOpen ? (
        <button type="button" onClick={() => setFormOpen(true)} aria-expanded="false" className="bg-card mt-4 flex min-h-12 w-full items-center justify-between rounded-xl px-4 text-left">
          <span className="text-[15px] font-bold">Check another order</span>
          <ChevronDown className="text-brand-deep h-5 w-5" aria-hidden="true" />
        </button>
      ) : (
        <form onSubmit={check} className="mt-4 space-y-4">
          <p className="text-sm text-[var(--ink-soft)]">{t.instructions}</p>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">{t.code}</span><input className="input uppercase !rounded-xl" required autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">{t.mobile}</span><input className="input !rounded-xl" required inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          <button disabled={loading} className="bg-brand-deep flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 font-semibold text-white disabled:opacity-60">
            <Search className="h-4 w-4" aria-hidden="true" />
            {loading ? "Checking…" : t.submit}
          </button>
        </form>
      )}

      {message && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{message}</p>}

      {result && summary && (
        <section className="mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-[var(--line)]" aria-label={`Order ${result.order_code}`} aria-live="polite">
          <div className={`px-5 py-5 ${result.status === "cancelled" ? "bg-red-50" : "bg-brand-tint"}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">{t.order} {result.order_code}</p>
            <div className="mt-2 flex items-center gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${result.status === "cancelled" ? "bg-red-100 text-red-700" : "bg-brand-deep text-white"}`}>
                {result.status === "cancelled" ? <XCircle className="h-6 w-6" aria-hidden="true" /> : <PackageCheck className="h-6 w-6" aria-hidden="true" />}
              </span>
              <div className="min-w-0">
                <h2 className={`font-serif text-2xl font-semibold leading-tight ${result.status === "cancelled" ? "text-red-800" : "text-brand-deep"}`}>{summary.title}</h2>
                {summary.detail && <p className="text-sm text-stone-700">{summary.detail}</p>}
              </div>
            </div>
          </div>

          {result.status !== "cancelled" && (
            <div className="px-4 pb-2 pt-5">
              <OrderProgress steps={steps} status={result.status} />
            </div>
          )}

          <dl className="space-y-2.5 border-t border-[var(--line)] px-5 py-4 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-[var(--ink-soft)]">Placed</dt><dd className="text-right font-semibold">{new Date(result.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[var(--ink-soft)]">{t.method}</dt><dd className="font-semibold">{result.fulfilment === "pickup" ? "Pickup from shop" : "Home delivery"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[var(--ink-soft)]">{t.total}</dt><dd className="font-semibold">₹{new Intl.NumberFormat("en-IN").format(result.total)}</dd></div>
          </dl>

          {shop?.phone && (
            <div className="border-t border-[var(--line)] p-4">
              <a href={`tel:${shop.phone}`} className="text-brand-deep border-brand flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] font-semibold">
                <Phone className="h-4 w-4" aria-hidden="true" />
                Call store
              </a>
            </div>
          )}
        </section>
      )}

      {!result && !message && !loading && (
        <p className="mt-6 text-center text-xs text-[var(--ink-soft)]">Your order code is shown when you place an order.</p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20">
        <BottomNav slug={slug} active="orders" />
      </div>
    </main>
  );
}

function OrderProgress({ steps, status }: { steps: Step[]; status: string }) {
  // Pickup orders never reach "out for delivery"; if one somehow does, show it as confirmed.
  const effective = steps.some((step) => step.key === status) ? status : "confirmed";
  const currentIndex = steps.findIndex((step) => step.key === effective);
  return (
    <ol className="flex items-start" aria-label="Order progress">
      {steps.map((step, index) => {
        const done = index < currentIndex || (index === currentIndex && step.key === "delivered");
        const current = index === currentIndex && !done;
        return (
          <Fragment key={step.key}>
            {index > 0 && <li aria-hidden="true" className={`mt-4 h-0.5 flex-1 ${index <= currentIndex ? "bg-brand" : "bg-stone-200"}`} />}
            <li className="flex w-[4.5rem] shrink-0 flex-col items-center" aria-current={current ? "step" : undefined}>
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-brand text-white" : current ? "bg-brand-tint text-brand-deep ring-brand ring-2" : "bg-stone-200 text-stone-500"}`}>
                {done ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
              </span>
              <span className={`mt-2 text-center text-[11px] font-semibold leading-tight ${index <= currentIndex ? "text-[var(--ink)]" : "text-stone-400"}`}>{step.label}</span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
