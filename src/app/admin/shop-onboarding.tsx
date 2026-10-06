"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";

export function ShopOnboarding({ onCreated }: { onCreated: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const text = (key: string) => String(values.get(key) ?? "").trim();
    if (!/^[6-9]\d{9}$/.test(text("phone"))) { setMessage("Enter a valid 10-digit Indian mobile number."); return; }
    setBusy(true); setMessage("");
    try {
      const { error } = await getBrowserClient().from("shops").insert({
        name: text("name"), slug: text("slug"), phone: `+91${text("phone")}`,
        owner_email: text("email"), address: text("address"), active: false,
        min_order: Number(text("minimum")), delivery_fee: Number(text("delivery")),
        delivery_enabled: values.has("delivers"), pickup_enabled: values.has("pickup"),
      });
      if (error) { setMessage(error.code === "23505" ? "That shop link already exists. Choose another link." : error.message); return; }
      form.reset(); await onCreated(); setMessage("Shop saved as inactive. Assign an owner and add products before launching.");
    } catch { setMessage("Could not save the shop. Please try again."); }
    finally { setBusy(false); }
  }

  return <details className="m-4 rounded-2xl border border-slate-200 bg-white p-5">
    <summary className="cursor-pointer font-bold">Register a neighbourhood shop</summary>
    <p className="mt-2 text-sm text-slate-600">New shops start inactive so customers cannot order before setup is complete.</p>
    <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
      <Field label="Shop name" name="name" maxLength={120} />
      <Field label="Shop link (for example: lakshmi-manikonda)" name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} />
      <Field label="Shop mobile number" name="phone" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} />
      <Field label="Owner email" name="email" type="email" />
      <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Shop address</span><textarea name="address" className="input" required maxLength={500} /></label>
      <Field label="Minimum order (₹)" name="minimum" type="number" min="0" step="0.01" defaultValue="199" />
      <Field label="Delivery fee (₹)" name="delivery" type="number" min="0" step="0.01" defaultValue="30" />
      <label className="text-sm"><input type="checkbox" name="delivers" defaultChecked /> Delivery available</label>
      <label className="text-sm"><input type="checkbox" name="pickup" defaultChecked /> Pickup available</label>
      <p role="status" className="text-sm sm:col-span-2">{message}</p>
      <button disabled={busy} className="rounded-xl bg-emerald-800 px-4 py-3 font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save shop"}</button>
    </form>
  </details>;
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label><span className="mb-2 block text-sm font-semibold">{label}</span><input className="input" required {...props} /></label>;
}
