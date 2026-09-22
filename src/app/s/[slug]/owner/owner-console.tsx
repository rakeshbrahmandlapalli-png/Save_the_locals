"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";

type Item = { id: string; name: string; unit: string; price: number; qty: number; status: string; substitute_name: string | null; substitute_price: number | null };
type Order = { id: string; code: string; status: string; fulfilment: string; address: string | null; notes: string | null; payment_method: string; total: number; source: string; is_new_customer: boolean; created_at: string; customer: { name: string | null; phone: string }; items: Item[] };
type Shop = { id: string; name: string; phone: string };

const statuses = ["confirmed", "out_for_delivery", "delivered", "cancelled"] as const;

export function OwnerConsole({ slug }: { slug: string }) {
  const supabase = getBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shop, setShop] = useState<Shop | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [authorised, setAuthorised] = useState<boolean | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [message, setMessage] = useState("");

  const loadOrders = useCallback(async (shopId: string) => {
    const { data, error } = await supabase.from("orders").select("id,code,status,fulfilment,address,notes,payment_method,total,source,is_new_customer,created_at,customer:customers(name,phone),items:order_items(id,name,unit,price,qty,status,substitute_name,substitute_price)").eq("shop_id", shopId).order("created_at", { ascending: false });
    if (error) { setMessage(error.message); return; }
    setOrders((data ?? []) as unknown as Order[]);
  }, [supabase]);

  const initialise = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSignedIn(Boolean(session));
    if (!session) { setAuthorised(null); return; }
    const { data: foundShop } = await supabase.from("shops").select("id,name,phone").eq("slug", slug).single();
    if (!foundShop) { setMessage("Shop not found."); return; }
    const { data: membership } = await supabase.from("shop_staff").select("role").eq("shop_id", foundShop.id).maybeSingle();
    if (!membership) { setShop(foundShop); setAuthorised(false); return; }
    setShop(foundShop); setAuthorised(true); await loadOrders(foundShop.id);
  }, [loadOrders, slug, supabase]);

  useEffect(() => {
    const task = window.setTimeout(() => void initialise(), 0);
    return () => window.clearTimeout(task);
  }, [initialise]);

  useEffect(() => {
    if (!shop || !authorised) return;
    const channel = supabase.channel(`owner-orders-${shop.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `shop_id=eq.${shop.id}` }, () => {
      if (alertsEnabled) playAlert();
      void loadOrders(shop.id);
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [alertsEnabled, authorised, loadOrders, shop, supabase]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMessage(error.message); return; }
    await initialise();
  }

  async function updateStatus(orderId: string, next: string) {
    const { error } = await supabase.rpc("owner_update_order_status", { target_order_id: orderId, next_status: next });
    if (error) setMessage(error.message); else if (shop) await loadOrders(shop.id);
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

  if (!signedIn) return <main className="mx-auto min-h-screen max-w-md px-4 py-12"><p className="text-sm font-semibold text-slate-500">Owner console</p><h1 className="mt-2 text-3xl font-bold">Sign in to your shop</h1><p className="mt-2 text-sm text-slate-600">Use your own owner email and password.</p><form onSubmit={signIn} className="mt-8 space-y-4"><label className="block"><span className="mb-2 block text-sm font-bold">Email</span><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label className="block"><span className="mb-2 block text-sm font-bold">Password</span><input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>{message && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p>}<button className="w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white">Sign in</button></form></main>;
  if (authorised === false) return <main className="mx-auto max-w-lg px-4 py-16"><h1 className="text-2xl font-bold">Access denied</h1><p className="mt-2 text-slate-600">This account is not staff for {shop?.name}.</p><button onClick={() => void supabase.auth.signOut().then(initialise)} className="mt-6 rounded-lg border px-4 py-2 font-semibold">Sign out</button></main>;
  if (!authorised || !shop) return <main className="p-8 text-center">Loading owner console…</main>;

  return <main className="mx-auto min-h-screen max-w-3xl bg-slate-50 pb-16 text-slate-950"><header className="sticky top-0 z-10 border-b bg-white px-4 py-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Owner console</p><h1 className="text-xl font-bold">{shop.name}</h1></div><button onClick={() => { setAlertsEnabled(true); playAlert(); }} className={`rounded-lg px-3 py-2 text-sm font-bold ${alertsEnabled ? "bg-emerald-50 text-emerald-800" : "bg-slate-900 text-white"}`}>{alertsEnabled ? "Sound alerts on" : "Enable sound"}</button></div></header>
    {message && <p className="m-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p>}
    <section className="space-y-4 p-4">{orders.length === 0 ? <p className="rounded-xl border bg-white p-8 text-center text-slate-600">No orders yet.</p> : orders.map((order) => <OrderCard key={order.id} order={order} onStatus={updateStatus} onItem={resolveItem} />)}</section>
  </main>;
}

function OrderCard({ order, onStatus, onItem }: { order: Order; onStatus: (id: string, status: string) => Promise<void>; onItem: (item: Item, status: "out_of_stock" | "skipped" | "substituted") => Promise<void> }) {
  const finalised = order.status === "delivered" || order.status === "cancelled";
  const deliveryText = [`Order ${order.code}`, order.customer.name || "Customer", order.customer.phone, order.address || "Pickup", ...order.items.map((item) => `${item.qty} × ${item.name}`)].join("\n");
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black">#{order.code}</h2>{order.is_new_customer && <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">New customer</span>}</div><p className="mt-1 text-sm font-semibold">{order.customer.name || "Customer"} · {order.customer.phone}</p><p className="mt-1 text-xs text-slate-500">{new Date(order.created_at).toLocaleString("en-IN")} · {order.source}</p></div><div className="text-right"><p className="font-black">₹{Number(order.total).toLocaleString("en-IN")}</p><p className="mt-1 text-sm capitalize text-slate-600">{order.status.replaceAll("_", " ")}</p></div></div>
    <div className="mt-4 divide-y rounded-xl border">{order.items.map((item) => <div key={item.id} className="p-3"><div className="flex justify-between gap-3"><p className="text-sm font-semibold">{item.qty} × {item.name} <span className="font-normal text-slate-500">{item.unit}</span></p><p className="text-sm">₹{Number(item.price * item.qty).toLocaleString("en-IN")}</p></div>{item.status !== "ok" && <p className="mt-1 text-xs font-bold uppercase text-amber-700">{item.status.replaceAll("_", " ")}{item.substitute_name ? `: ${item.substitute_name} ₹${item.substitute_price}` : ""}</p>}{!finalised && <div className="mt-2 flex flex-wrap gap-2"><button onClick={() => void onItem(item, "out_of_stock")} className="rounded-md border px-2 py-1 text-xs font-semibold">Out of stock</button><button onClick={() => void onItem(item, "substituted")} className="rounded-md border px-2 py-1 text-xs font-semibold">Substitute</button><button onClick={() => void onItem(item, "skipped")} className="rounded-md border px-2 py-1 text-xs font-semibold">Skip</button></div>}</div>)}</div>
    {order.notes && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm"><strong>Note:</strong> {order.notes}</p>}<div className="mt-4 flex flex-wrap gap-2">{!finalised && statuses.map((status) => <button key={status} disabled={order.status === status} onClick={() => void onStatus(order.id, status)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold capitalize disabled:bg-slate-100 disabled:text-slate-400">{status.replaceAll("_", " ")}</button>)}<a href={`https://wa.me/?text=${encodeURIComponent(deliveryText)}`} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Share with delivery person</a></div>
  </article>;
}

function playAlert() {
  const context = new AudioContext();
  const oscillator = context.createOscillator(); const gain = context.createGain();
  oscillator.type = "square"; oscillator.frequency.value = 880; gain.gain.value = 0.25;
  oscillator.connect(gain); gain.connect(context.destination); oscillator.start();
  oscillator.frequency.setValueAtTime(660, context.currentTime + 0.18); oscillator.stop(context.currentTime + 0.45);
}
