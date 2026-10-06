"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useShopStaffSession } from "@/lib/use-shop-staff-session";

type Item = { id: string; name: string; unit: string; price: number; qty: number; status: string; substitute_name: string | null; substitute_price: number | null };
type Order = { id: string; code: string; status: string; fulfilment: string; address: string | null; notes: string | null; payment_method: string; total: number; source: string; is_new_customer: boolean; created_at: string; customer: { name: string | null; phone: string }; items: Item[] };
type HelpRequest = { id: string; order_id: string; category: string; message: string; status: string; created_at: string; order: { code: string; status: string; customer: { name: string | null; phone: string } | null } | null };

export function OwnerConsole({ slug }: { slug: string }) {
  const { supabase, email, setEmail, password, setPassword, shop, signedIn, authorised, message, setMessage, signIn, signOut, register } = useShopStaffSession(slug);
  const [orders, setOrders] = useState<Order[]>([]);
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);
  const [alertsEnabled, setAlertsEnabled] = useState(false);

  const loadOrders = useCallback(async (shopId: string) => {
    const { data, error } = await supabase.from("orders").select("id,code,status,fulfilment,address,notes,payment_method,total,source,is_new_customer,created_at,customer:customers(name,phone),items:order_items(id,name,unit,price,qty,status,substitute_name,substitute_price)").eq("shop_id", shopId).order("created_at", { ascending: false });
    if (error) { setMessage(error.message); return; }
    setOrders((data ?? []) as unknown as Order[]);
  }, [setMessage, supabase]);

  const loadHelp = useCallback(async (shopId: string) => {
    const { data, error } = await supabase.from("support_requests")
      .select("id,order_id,category,message,status,created_at,order:orders(code,status,customer:customers(name,phone))")
      .eq("shop_id", shopId).eq("status", "open").order("created_at", { ascending: false });
    if (error) setMessage(error.message);
    else setHelpRequests((data ?? []) as unknown as HelpRequest[]);
  }, [setMessage, supabase]);

  useEffect(() => {
    if (!shop || !authorised) return;
    const task = window.setTimeout(() => { void loadOrders(shop.id); void loadHelp(shop.id); }, 0);
    return () => window.clearTimeout(task);
  }, [authorised, loadHelp, loadOrders, shop]);

  useEffect(() => {
    if (!shop || !authorised) return;
    const channel = supabase.channel(`owner-orders-${shop.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `shop_id=eq.${shop.id}` }, () => {
      if (alertsEnabled) playAlert();
      void loadOrders(shop.id);
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [alertsEnabled, authorised, loadOrders, shop, supabase]);

  async function updateStatus(orderId: string, next: string) {
    const { error } = await supabase.rpc("owner_update_order_status", { target_order_id: orderId, next_status: next });
    if (error) setMessage(error.message); else if (shop) await loadOrders(shop.id);
  }

  async function cancelOrder(orderId: string) {
    const reason = window.prompt("Why is this order being cancelled? This reason is kept with the order.");
    if (!reason) return;
    const { error } = await supabase.rpc("owner_cancel_order", { target_order_id: orderId, reason: reason.trim() });
    if (error) setMessage(error.message); else if (shop) await Promise.all([loadOrders(shop.id), loadHelp(shop.id)]);
  }

  async function resolveHelp(requestId: string) {
    const note = window.prompt("How was this request resolved? This note is kept for staff.");
    if (!note) return;
    const { error } = await supabase.rpc("resolve_order_support", { target_request_id: requestId, note: note.trim() });
    if (error) setMessage(error.message); else if (shop) await loadHelp(shop.id);
  }

  async function resolveItem(item: Item, next: "out_of_stock" | "skipped" | "substituted") {
    let substituteName: string | null = null; let substitutePrice: number | null = null;
    if (next === "substituted") {
      substituteName = window.prompt("Substitute product name");
      const rawPrice = window.prompt("Substitute price");
      if (!substituteName || rawPrice === null) return;
      substitutePrice = Number(rawPrice);
    }
    const { error } = await supabase.rpc("owner_update_order_item", { target_item_id: item.id, next_status: next, new_substitute_name: substituteName, new_substitute_price: substitutePrice });
    if (error) setMessage(error.message); else if (shop) await loadOrders(shop.id);
  }

  if (!signedIn) return <main className="mx-auto min-h-screen max-w-md px-4 py-12"><p className="text-sm font-semibold text-slate-500">Owner console</p><h1 className="mt-2 text-3xl font-bold">Sign in to your shop</h1><p className="mt-2 text-sm text-slate-600">Use the email invited by Nextdoor Basket.</p><form onSubmit={signIn} className="mt-8 space-y-4"><label className="block"><span className="mb-2 block text-sm font-bold">Email</span><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label className="block"><span className="mb-2 block text-sm font-bold">Password</span><input className="input" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>{message && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}<button className="w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white">Sign in</button><button type="button" onClick={(event) => void register(event)} className="w-full rounded-xl border px-4 py-3 font-bold">Create owner account</button></form></main>;
  if (authorised === false) return <main className="mx-auto max-w-lg px-4 py-16"><h1 className="text-2xl font-bold">Access denied</h1><p className="mt-2 text-slate-600">This account is not staff for {shop?.name}.</p><button onClick={() => void signOut()} className="mt-6 rounded-lg border px-4 py-2 font-semibold">Sign out</button></main>;
  if (!authorised || !shop) return <main className="p-8 text-center">Loading owner console…</main>;

  return <main className="mx-auto min-h-screen max-w-3xl bg-slate-50 pb-16 text-slate-950"><header className="sticky top-0 z-10 border-b bg-white px-4 py-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Owner console</p><h1 className="text-xl font-bold">{shop.name}</h1></div><div className="flex items-center gap-2"><Link href={`/s/${slug}/owner/catalogue`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold">Catalogue</Link><Link href={`/s/${slug}/owner/qr`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold">QR codes</Link><button onClick={() => { setAlertsEnabled(true); playAlert(); }} className={`rounded-lg px-3 py-2 text-sm font-bold ${alertsEnabled ? "bg-emerald-50 text-emerald-800" : "bg-slate-900 text-white"}`}>{alertsEnabled ? "Sound alerts on" : "Enable sound"}</button></div></div></header>
    {message && <p className="m-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p>}
    <section className="m-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center justify-between gap-3"><h2 className="font-bold">Customer requests · {helpRequests.length} open</h2><button onClick={() => { if (shop) void loadHelp(shop.id); }} className="rounded-lg border border-amber-400 px-3 py-1.5 text-sm font-semibold">Refresh</button></div>
      {helpRequests.length === 0 && <p className="mt-2 text-sm text-slate-600">No open requests.</p>}
      <ul className="mt-2 divide-y divide-amber-200">{helpRequests.map((request) => <li key={request.id} className="space-y-2 py-3 text-sm">
        <p className="font-bold">Order #{request.order?.code ?? "?"} · {request.category.replaceAll("_", " ")}</p>
        <p>{request.message}</p>
        {request.order?.customer && <a href={`tel:${request.order.customer.phone}`} className="block font-semibold underline">Call {request.order.customer.name ?? "customer"}: {request.order.customer.phone}</a>}
        <div className="flex flex-wrap gap-2">{request.category === "cancel_request" && request.order && !["delivered", "cancelled"].includes(request.order.status) && <button onClick={() => void cancelOrder(request.order_id)} className="rounded-lg border border-red-300 px-3 py-2 font-semibold text-red-800">Cancel order</button>}<button onClick={() => void resolveHelp(request.id)} className="rounded-lg border border-amber-400 px-3 py-2 font-semibold">Record resolution</button></div>
      </li>)}</ul>
    </section>
    <section className="space-y-4 p-4">{orders.length === 0 ? <p className="rounded-xl border bg-white p-8 text-center text-slate-600">No orders yet.</p> : orders.map((order) => <OrderCard key={order.id} order={order} onStatus={updateStatus} onCancel={cancelOrder} onItem={resolveItem} />)}</section>
  </main>;
}

function OrderCard({ order, onStatus, onCancel, onItem }: { order: Order; onStatus: (id: string, status: string) => Promise<void>; onCancel: (id: string) => Promise<void>; onItem: (item: Item, status: "out_of_stock" | "skipped" | "substituted") => Promise<void> }) {
  const finalised = order.status === "delivered" || order.status === "cancelled";
  const nextStatus = order.status === "new" ? "confirmed" : order.status === "confirmed" ? (order.fulfilment === "pickup" ? "delivered" : "out_for_delivery") : order.status === "out_for_delivery" ? "delivered" : null;
  const deliveryText = [`Order ${order.code}`, order.customer.name || "Customer", order.customer.phone, order.address || "Pickup", ...order.items.map((item) => `${item.qty} × ${item.name}`)].join("\n");
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black">#{order.code}</h2>{order.is_new_customer && <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">New customer</span>}</div><p className="mt-1 text-sm font-semibold">{order.customer.name || "Customer"} · {order.customer.phone}</p><p className="mt-1 text-xs text-slate-500">{new Date(order.created_at).toLocaleString("en-IN")} · {order.source}</p></div><div className="text-right"><p className="font-black">₹{Number(order.total).toLocaleString("en-IN")}</p><p className="mt-1 text-sm capitalize text-slate-600">{order.status.replaceAll("_", " ")}</p></div></div>
    <div className="mt-4 divide-y rounded-xl border">{order.items.map((item) => <div key={item.id} className="p-3"><div className="flex justify-between gap-3"><p className="text-sm font-semibold">{item.qty} × {item.name} <span className="font-normal text-slate-500">{item.unit}</span></p><p className="text-sm">₹{Number(item.price * item.qty).toLocaleString("en-IN")}</p></div>{item.status !== "ok" && <p className="mt-1 text-xs font-bold uppercase text-amber-700">{item.status.replaceAll("_", " ")}{item.substitute_name ? `: ${item.substitute_name} ₹${item.substitute_price}` : ""}</p>}{!finalised && <div className="mt-2 flex flex-wrap gap-2"><button onClick={() => void onItem(item, "out_of_stock")} className="rounded-md border px-2 py-1 text-xs font-semibold">Out of stock</button><button onClick={() => void onItem(item, "substituted")} className="rounded-md border px-2 py-1 text-xs font-semibold">Substitute</button><button onClick={() => void onItem(item, "skipped")} className="rounded-md border px-2 py-1 text-xs font-semibold">Skip</button></div>}</div>)}</div>
    {order.notes && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm"><strong>Note:</strong> {order.notes}</p>}<div className="mt-4 flex flex-wrap gap-2">{nextStatus && <button onClick={() => void onStatus(order.id, nextStatus)} className="rounded-lg border border-emerald-700 bg-emerald-700 px-3 py-2 text-xs font-bold capitalize text-white">Mark {nextStatus.replaceAll("_", " ")}</button>}{!finalised && <button onClick={() => void onCancel(order.id)} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-800">Cancel with reason</button>}<a href={`https://wa.me/?text=${encodeURIComponent(deliveryText)}`} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Share with delivery person</a></div>
  </article>;
}

function playAlert() {
  const context = new AudioContext();
  const oscillator = context.createOscillator(); const gain = context.createGain();
  oscillator.type = "square"; oscillator.frequency.value = 880; gain.gain.value = 0.25;
  oscillator.connect(gain); gain.connect(context.destination); oscillator.start();
  oscillator.frequency.setValueAtTime(660, context.currentTime + 0.18); oscillator.stop(context.currentTime + 0.45);
}
