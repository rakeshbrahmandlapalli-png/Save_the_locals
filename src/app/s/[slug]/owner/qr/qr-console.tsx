"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { useShopStaffSession } from "@/lib/use-shop-staff-session";

const DEFAULT_SOURCES = ["pamphlet-a", "pamphlet-b", "counter", "gate"];

export function QrConsole({ slug }: { slug: string }) {
  const { email, setEmail, password, setPassword, shop, signedIn, authorised, message, signIn, signOut } = useShopStaffSession(slug);
  const [sourceNames, setSourceNames] = useState<string[]>(DEFAULT_SOURCES);
  const [newSourceName, setNewSourceName] = useState("");
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    const task = window.setTimeout(() => setOrigin(window.location.origin), 0);
    return () => window.clearTimeout(task);
  }, []);

  useEffect(() => {
    if (!origin) return;
    let cancelled = false;
    const task = window.setTimeout(() => {
      void (async () => {
        const entries = await Promise.all(sourceNames.map(async (name) => {
          const url = `${origin}/s/${slug}?src=${encodeURIComponent(name)}`;
          const dataUrl = await QRCode.toDataURL(url, { width: 320, margin: 1 });
          return [name, dataUrl] as const;
        }));
        if (!cancelled) setQrImages(Object.fromEntries(entries));
      })();
    }, 0);
    return () => { cancelled = true; window.clearTimeout(task); };
  }, [origin, slug, sourceNames]);

  function addSource(event: React.FormEvent) {
    event.preventDefault();
    const name = newSourceName.trim().toLowerCase().replace(/\s+/g, "-");
    if (!name || sourceNames.includes(name)) return;
    setSourceNames((current) => [...current, name]);
    setNewSourceName("");
  }

  function removeSource(name: string) {
    setSourceNames((current) => current.filter((existing) => existing !== name));
  }

  if (!signedIn) return <main className="mx-auto min-h-screen max-w-md px-4 py-12"><p className="text-sm font-semibold text-slate-500">QR codes</p><h1 className="mt-2 text-3xl font-bold">Sign in to your shop</h1><form onSubmit={signIn} className="mt-8 space-y-4"><label className="block"><span className="mb-2 block text-sm font-bold">Email</span><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label className="block"><span className="mb-2 block text-sm font-bold">Password</span><input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>{message && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p>}<button className="w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white">Sign in</button></form></main>;
  if (authorised === false) return <main className="mx-auto max-w-lg px-4 py-16"><h1 className="text-2xl font-bold">Access denied</h1><p className="mt-2 text-slate-600">This account is not staff for {shop?.name}.</p><button onClick={() => void signOut()} className="mt-6 rounded-lg border px-4 py-2 font-semibold">Sign out</button></main>;
  if (!authorised || !shop) return <main className="p-8 text-center">Loading…</main>;

  return <main className="mx-auto min-h-screen max-w-4xl bg-slate-50 pb-16 text-slate-950">
    <header className="sticky top-0 z-10 border-b bg-white px-4 py-4 print:hidden">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">QR codes</p><h1 className="text-xl font-bold">{shop.name}</h1></div>
        <div className="flex items-center gap-2">
          <Link href={`/s/${slug}/owner`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold">Orders</Link>
          <button onClick={() => window.print()} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white">Print</button>
        </div>
      </div>
    </header>

    <section className="m-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
      <h2 className="text-lg font-black">Add a source</h2>
      <p className="mt-1 text-sm text-slate-600">A short name for where a code will be placed — a specific pamphlet, the shop counter, the gate. Each gets its own code so orders can be traced back to it.</p>
      <form onSubmit={addSource} className="mt-3 flex gap-2">
        <input className="input flex-1" placeholder="e.g. pamphlet-c" value={newSourceName} onChange={(e) => setNewSourceName(e.target.value)} />
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Add</button>
      </form>
    </section>

    <section className="m-4 grid grid-cols-1 gap-4 sm:grid-cols-2 print:m-0 print:block print:gap-0">
      {sourceNames.map((name) => (
        <article key={name} className="break-inside-avoid rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm print:mb-8 print:rounded-none print:border-2 print:border-dashed print:p-10 print:shadow-none">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">{shop.name}</p>
          <p className="mt-1 text-xs text-slate-500">Scan to order online</p>
          {qrImages[name] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrImages[name]} alt={`QR code for ${name}`} className="mx-auto mt-4 h-48 w-48" />
          ) : (
            <div className="mx-auto mt-4 h-48 w-48 animate-pulse rounded bg-slate-100" />
          )}
          <p className="mt-4 text-lg font-black">{name}</p>
          <div className="mt-3 flex justify-center gap-2 print:hidden">
            <button onClick={() => removeSource(name)} className="text-xs font-bold text-red-600">Remove</button>
          </div>
        </article>
      ))}
    </section>
  </main>;
}
