"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlatformAdminSession } from "@/lib/use-platform-admin-session";

type Shop = { id: string; name: string; slug: string };
type OrderRow = { id: string; source: string; is_new_customer: boolean; status: string; total: number; created_at: string; confirmed_at: string | null; customer_id: string };
type SourceStats = {
  source: string;
  orders: number;
  newCustomers: number;
  repeatCustomers: number;
  cancelled: number;
  cancellationRate: number;
  avgConfirmMinutes: number | null;
  avgOrderValue: number;
};

function computeStats(orders: OrderRow[]): SourceStats[] {
  const orderCountByCustomer = new Map<string, number>();
  for (const order of orders) orderCountByCustomer.set(order.customer_id, (orderCountByCustomer.get(order.customer_id) ?? 0) + 1);

  const bySource = new Map<string, OrderRow[]>();
  for (const order of orders) {
    const list = bySource.get(order.source) ?? [];
    list.push(order);
    bySource.set(order.source, list);
  }

  return Array.from(bySource.entries()).map(([source, rows]) => {
    const newCustomerIds = new Set(rows.filter((row) => row.is_new_customer).map((row) => row.customer_id));
    const repeatCustomerIds = new Set(rows.filter((row) => (orderCountByCustomer.get(row.customer_id) ?? 0) >= 2).map((row) => row.customer_id));
    const cancelled = rows.filter((row) => row.status === "cancelled").length;
    const confirmMinutes = rows.filter((row) => row.confirmed_at).map((row) => (new Date(row.confirmed_at as string).getTime() - new Date(row.created_at).getTime()) / 60000);
    const avgOrderValue = rows.reduce((sum, row) => sum + Number(row.total), 0) / rows.length;
    return {
      source,
      orders: rows.length,
      newCustomers: newCustomerIds.size,
      repeatCustomers: repeatCustomerIds.size,
      cancelled,
      cancellationRate: rows.length ? cancelled / rows.length : 0,
      avgConfirmMinutes: confirmMinutes.length ? confirmMinutes.reduce((a, b) => a + b, 0) / confirmMinutes.length : null,
      avgOrderValue,
    };
  }).sort((a, b) => b.orders - a.orders);
}

export function AdminConsole() {
  const { supabase, email, setEmail, password, setPassword, signedIn, authorised, message, setMessage, signIn, signOut } = usePlatformAdminSession();
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadShops = useCallback(async () => {
    const { data, error } = await supabase.from("shops").select("id,name,slug").order("name");
    if (error) { setMessage(error.message); return; }
    setShops(data ?? []);
    if (!shopId && data && data.length > 0) setShopId(data[0].id);
  }, [setMessage, shopId, supabase]);

  useEffect(() => {
    if (!authorised) return;
    const task = window.setTimeout(() => void loadShops(), 0);
    return () => window.clearTimeout(task);
  }, [authorised, loadShops]);

  const loadOrders = useCallback(async (id: string) => {
    setLoading(true);
    const { data, error } = await supabase.from("orders").select("id,source,is_new_customer,status,total,created_at,confirmed_at,customer_id").eq("shop_id", id);
    setLoading(false);
    if (error) { setMessage(error.message); return; }
    setOrders((data ?? []) as OrderRow[]);
  }, [setMessage, supabase]);

  useEffect(() => {
    if (!shopId) return;
    const task = window.setTimeout(() => void loadOrders(shopId), 0);
    return () => window.clearTimeout(task);
  }, [shopId, loadOrders]);

  if (!signedIn) return <main className="mx-auto min-h-screen max-w-md px-4 py-12"><p className="text-sm font-semibold text-slate-500">Founder dashboard</p><h1 className="mt-2 text-3xl font-bold">Sign in</h1><form onSubmit={signIn} className="mt-8 space-y-4"><label className="block"><span className="mb-2 block text-sm font-bold">Email</span><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label className="block"><span className="mb-2 block text-sm font-bold">Password</span><input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>{message && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p>}<button className="w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white">Sign in</button></form></main>;
  if (authorised === false) return <main className="mx-auto max-w-lg px-4 py-16"><h1 className="text-2xl font-bold">Access denied</h1><p className="mt-2 text-slate-600">This account is not a platform admin.</p><button onClick={() => void signOut()} className="mt-6 rounded-lg border px-4 py-2 font-semibold">Sign out</button></main>;
  if (!authorised) return <main className="p-8 text-center">Loading…</main>;

  const stats = computeStats(orders);
  const selectedShop = shops.find((shop) => shop.id === shopId);
  const totals = {
    orders: orders.length,
    newCustomers: new Set(orders.filter((o) => o.is_new_customer).map((o) => o.customer_id)).size,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  };

  return <main className="mx-auto min-h-screen max-w-4xl bg-slate-50 pb-16 text-slate-950">
    <header className="border-b bg-white px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Founder dashboard</p>
      <h1 className="mt-1 text-xl font-bold">Pilot measurement</h1>
      <select className="input mt-3" value={shopId} onChange={(e) => setShopId(e.target.value)}>
        {shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
      </select>
    </header>

    {message && <p className="m-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p>}
    {loading && <p className="m-4 text-sm text-slate-600">Loading…</p>}

    {!loading && selectedShop && (
      <>
        <section className="m-4 grid grid-cols-3 gap-3">
          <Tile label="Total orders" value={String(totals.orders)} />
          <Tile label="New customers" value={String(totals.newCustomers)} />
          <Tile label="Cancelled" value={String(totals.cancelled)} />
        </section>

        <section className="m-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="p-3">Source</th>
                <th className="p-3">Orders</th>
                <th className="p-3">New customers</th>
                <th className="p-3">Repeat customers</th>
                <th className="p-3">Cancellation rate</th>
                <th className="p-3">Avg. time to confirm</th>
                <th className="p-3">Avg. order value</th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-500">No orders yet for this shop.</td></tr>}
              {stats.map((row) => (
                <tr key={row.source} className="border-b last:border-0">
                  <td className="p-3 font-semibold">{row.source}</td>
                  <td className="p-3">{row.orders}</td>
                  <td className="p-3">{row.newCustomers}</td>
                  <td className="p-3">{row.repeatCustomers}</td>
                  <td className="p-3">{(row.cancellationRate * 100).toFixed(0)}%</td>
                  <td className="p-3">{row.avgConfirmMinutes === null ? "—" : `${row.avgConfirmMinutes.toFixed(0)} min`}</td>
                  <td className="p-3">₹{row.avgOrderValue.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </>
    )}
  </main>;
}

function Tile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>;
}
