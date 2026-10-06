"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";

type Shop = { id: string; name: string; slug: string; owner_email: string | null; active: boolean };
type Commission = { order_id: string; product_value: number; commission_amount: number; status: string; created_at: string; settlement_reference: string | null };
type Ticket = { id: string; order_id: string; category: string; message: string; status: string; created_at: string; resolution_note: string | null; order: { code: string; status: string; customer: { name: string | null; phone: string } | null } | null };

const money = (value: number) => `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function BusinessOperations({ shop, onShopChanged, onOrdersChanged }: { shop: Shop; onShopChanged: () => Promise<void>; onOrdersChanged: () => Promise<void> }) {
  const supabase = getBrowserClient();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [invitation, setInvitation] = useState<{ email: string; claimed_at: string | null } | null>(null);
  const [ownerEmail, setOwnerEmail] = useState(shop.owner_email ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [fees, help, invites] = await Promise.all([
      supabase.from("commission_records").select("order_id,product_value,commission_amount,status,created_at,settlement_reference").eq("shop_id", shop.id).order("created_at", { ascending: false }),
      supabase.from("support_requests").select("id,order_id,category,message,status,created_at,resolution_note,order:orders(code,status,customer:customers(name,phone))").eq("shop_id", shop.id).order("created_at", { ascending: false }),
      supabase.from("shop_owner_invites").select("email,claimed_at").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const error = fees.error ?? help.error ?? invites.error;
    if (error) { setMessage(error.message); return; }
    setCommissions((fees.data ?? []) as Commission[]);
    setTickets((help.data ?? []) as unknown as Ticket[]);
    setInvitation(invites.data ?? null);
  }, [shop.id, supabase]);

  useEffect(() => {
    const task = window.setTimeout(() => { setOwnerEmail(shop.owner_email ?? ""); void refresh(); }, 0);
    return () => window.clearTimeout(task);
  }, [shop.owner_email, refresh]);

  async function invite(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const { data, error } = await supabase.rpc("admin_invite_shop_owner", { target_shop_id: shop.id, owner_email: ownerEmail.trim() });
    setBusy(false);
    setMessage(error?.message ?? String(data));
    if (!error) await refresh();
  }

  async function changeActive() {
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("admin_set_shop_active", { target_shop_id: shop.id, should_be_active: !shop.active });
    setBusy(false);
    if (error) setMessage(error.message);
    else { await onShopChanged(); setMessage(shop.active ? "Shop paused." : "Shop launched."); }
  }

  async function settle(orderId: string) {
    const reference = window.prompt("Enter the payment or settlement reference");
    if (!reference) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("admin_set_commission_settlement", { target_order_id: orderId, reference: reference.trim() });
    setBusy(false);
    if (error) setMessage(error.message); else await refresh();
  }

  async function resolve(ticketId: string) {
    const note = window.prompt("What was done to resolve this request? This note is kept for staff.");
    if (!note) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("resolve_order_support", { target_request_id: ticketId, note: note.trim() });
    setBusy(false);
    if (error) setMessage(error.message); else await refresh();
  }

  async function cancelRequestedOrder(orderId: string) {
    const reason = window.prompt("Give the customer a clear reason for cancelling this order");
    if (!reason) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("owner_cancel_order", { target_order_id: orderId, reason: reason.trim() });
    setBusy(false);
    if (error) setMessage(error.message);
    else { await Promise.all([onOrdersChanged(), refresh()]); setMessage("Order cancelled. Contact the customer, then record how the request was resolved."); }
  }

  const accrued = commissions.filter((record) => record.status === "accrued");
  const settled = commissions.filter((record) => record.status === "settled");
  const openTickets = tickets.filter((ticket) => ticket.status === "open");

  return <div className="space-y-4 p-4">
    {message && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">{message}</p>}
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="text-lg font-bold">Shop onboarding</h2>
      <p className="mt-1 text-sm text-slate-600">{shop.active ? "Customers can order from this shop." : "Shop is inactive while setup is completed."}</p>
      <form onSubmit={invite} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm font-semibold">Owner email
          <input className="input mt-1" type="email" required value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} />
        </label>
        <button disabled={busy} className="rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Set owner email</button>
      </form>
      {invitation && <p className="mt-2 text-sm text-slate-600">{invitation.email}: {invitation.claimed_at ? "access assigned" : "awaiting verified sign-in"}</p>}
      <p className="mt-2 text-xs text-slate-500">The owner registers with this same email on the shop owner page, verifies it, and signs in.</p>
      <button type="button" disabled={busy} onClick={() => void changeActive()} className="mt-4 rounded-xl border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-900 disabled:opacity-50">{shop.active ? "Pause shop" : "Launch shop"}</button>
      {!shop.active && <p className="mt-2 text-xs text-slate-500">Launching requires a verified owner and at least one available product.</p>}
    </section>

    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <h2 className="text-lg font-bold">Commission · 3% of delivered products</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div><dt>Accrued</dt><dd className="text-xl font-bold">{money(accrued.reduce((sum, record) => sum + Number(record.commission_amount), 0))}</dd></div>
        <div><dt>Settled</dt><dd className="text-xl font-bold">{money(settled.reduce((sum, record) => sum + Number(record.commission_amount), 0))}</dd></div>
      </dl>
      <p className="mt-2 text-xs text-slate-600">Recorded from orders delivered after this feature was enabled. Skipped items and delivery fees are excluded. Recording a fee does not collect payment.</p>
      {accrued.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Review {accrued.length} unpaid order fees</summary>
        <ul className="mt-2 divide-y">{accrued.map((record) => <li key={record.order_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{new Date(record.created_at).toLocaleDateString("en-IN")} · products {money(Number(record.product_value))}</span><strong>{money(Number(record.commission_amount))}</strong><button disabled={busy} onClick={() => void settle(record.order_id)} className="rounded-lg border px-2 py-1 font-semibold">Mark settled</button></li>)}</ul>
      </details>}
    </section>

    <section className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Customer help <span className="text-sm font-normal text-slate-500">· {openTickets.length} open</span></h2><button onClick={() => void refresh()} className="rounded-lg border px-3 py-1.5 text-sm font-semibold">Refresh</button></div>
      {openTickets.length === 0 && <p className="mt-3 text-sm text-slate-500">No open requests for this shop.</p>}
      <ul className="mt-3 divide-y">{openTickets.map((ticket) => <li key={ticket.id} className="space-y-2 py-3 text-sm">
        <p className="font-bold">Order #{ticket.order?.code ?? "?"} · {ticket.category.replaceAll("_", " ")}</p>
        <p>{ticket.message}</p>
        {ticket.order?.customer && <p className="text-slate-600">{ticket.order.customer.name ?? "Customer"} · <a className="underline" href={`tel:${ticket.order.customer.phone}`}>{ticket.order.customer.phone}</a></p>}
        <div className="flex flex-wrap gap-2">{ticket.category === "cancel_request" && ticket.order && !["delivered", "cancelled"].includes(ticket.order.status) && <button disabled={busy} onClick={() => void cancelRequestedOrder(ticket.order_id)} className="rounded-lg border border-red-300 px-3 py-2 font-semibold text-red-800">Cancel order</button>}<button disabled={busy} onClick={() => void resolve(ticket.id)} className="rounded-lg border px-3 py-2 font-semibold">Record resolution</button></div>
      </li>)}</ul>
    </section>
  </div>;
}
