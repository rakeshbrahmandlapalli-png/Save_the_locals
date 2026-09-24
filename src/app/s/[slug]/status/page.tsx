"use client";

import { Fragment, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createPublicClient } from "@/lib/supabase";
import { statusCopy as t } from "@/lib/copy";

type StatusResult = { order_code: string; status: string; fulfilment: string; total: number; created_at: string };

const STEPS = [
  { key: "new", label: "Order placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
] as const;

export default function OrderStatusPage() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearchParams();
  const [code, setCode] = useState(search.get("code") || "");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<StatusResult | null>(null);
  const [message, setMessage] = useState("");

  async function check(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    const { data, error } = await createPublicClient().rpc("order_status", { shop_slug: slug, code, phone });
    const row = (data as StatusResult[] | null)?.[0];
    if (error || !row) { setResult(null); setMessage(error?.message || t.notFound); return; }
    setResult(row);
  }

  return <main className="mx-auto min-h-screen max-w-lg bg-white px-4 py-10 text-slate-950">
    <a href={`/s/${slug}`} className="text-sm font-semibold text-slate-600">← {t.back}</a>
    <h1 className="mt-5 text-3xl font-bold">{t.title}</h1>
    <p className="mt-2 text-sm text-slate-600">{t.instructions}</p>
    <form onSubmit={check} className="mt-7 space-y-4">
      <label className="block"><span className="mb-2 block text-sm font-bold">{t.code}</span><input className="input uppercase" required value={code} onChange={(e) => setCode(e.target.value)} /></label>
      <label className="block"><span className="mb-2 block text-sm font-bold">{t.mobile}</span><input className="input" required inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      <button className="w-full rounded-xl bg-slate-900 px-5 py-3.5 font-bold text-white">{t.submit}</button>
    </form>
    {message && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{message}</p>}
    {result && (
      <section className="mt-6 rounded-2xl border border-slate-200 p-5">
        <p className="text-sm text-slate-500">{t.order} {result.order_code}</p>
        <div className="mt-5">
          <OrderProgress status={result.status} />
        </div>
        <dl className="mt-6 space-y-2 border-t border-slate-100 pt-5 text-sm">
          <div className="flex justify-between"><dt>{t.method}</dt><dd className="font-semibold capitalize">{result.fulfilment}</dd></div>
          <div className="flex justify-between"><dt>{t.total}</dt><dd className="font-semibold">₹{new Intl.NumberFormat("en-IN").format(result.total)}</dd></div>
        </dl>
      </section>
    )}
  </main>;
}

function OrderProgress({ status }: { status: string }) {
  if (status === "cancelled") {
    return <div className="rounded-xl bg-red-50 p-4 text-center text-sm font-semibold text-red-700">This order was cancelled.</div>;
  }
  const currentIndex = STEPS.findIndex((step) => step.key === status);
  return (
    <div className="flex items-start">
      {STEPS.map((step, index) => (
        <Fragment key={step.key}>
          {index > 0 && <div className={`mt-3.5 h-0.5 flex-1 ${index <= currentIndex ? "bg-emerald-600" : "bg-slate-200"}`} />}
          <div className="flex flex-col items-center">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index <= currentIndex ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"}`}>
              {index + 1}
            </div>
            <span className={`mt-2 w-16 text-center text-[11px] font-semibold leading-tight ${index <= currentIndex ? "text-slate-900" : "text-slate-400"}`}>
              {step.label}
            </span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
