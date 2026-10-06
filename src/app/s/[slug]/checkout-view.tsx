"use client";

import { storefrontName } from "@/lib/store-brand";
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, Check, Smartphone } from "lucide-react";
import { copy as t } from "@/lib/copy";
import { createPublicClient } from "@/lib/supabase";
import { Bill, FulfilmentSwitch } from "./basket-view";
import { formatMoney, useStore } from "./store-context";

type Field = "name" | "phone" | "address" | "terms";

/** Accepts 10 digits, optionally written with +91 / 91 / 0 in front, spaces or dashes. */
function isIndianMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  return /^[6-9]\d{9}$/.test(local);
}

export function CheckoutView({ depth }: { depth: number }) {
  const { shop, form, setForm, fulfilment, basketProducts, quantities, total, source, back, goHome, clearBasket, rememberOrder, typing, remaining } = useStore();
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderCode, setOrderCode] = useState<string | null>(null);
  const lock = useRef(false);

  function validate() {
    const next: Partial<Record<Field, string>> = {};
    if (!form.name.trim()) next.name = "Enter your name.";
    if (!isIndianMobile(form.phone)) next.phone = "Enter a 10-digit mobile number.";
    if (fulfilment === "delivery" && !form.address.trim()) next.address = "Enter the address to deliver to.";
    if (!agreed) next.terms = "Please agree to the Terms and Privacy Policy.";
    setErrors(next);
    const first = (["name", "phone", "address", "terms"] as Field[]).find((field) => next[field]);
    if (first) document.getElementById(`checkout-${first}`)?.focus();
    return !first;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return; // prevents a double tap from placing two orders
    setSubmitError("");
    if (!validate()) return;
    lock.current = true;
    setSubmitting(true);
    const items = basketProducts.map((product) => ({ product_id: product.id, qty: quantities[product.id] ?? 0 }));
    try {
      const { data, error } = await createPublicClient().rpc("place_order", {
        shop_slug: shop.slug,
        items,
        customer: { name: form.name.trim(), phone: form.phone, notes: form.notes },
        fulfilment,
        address: fulfilment === "delivery" ? form.address : "",
        payment_method: form.payment,
        source,
      });
      if (error) {
        setSubmitError(error.message);
        lock.current = false;
        return;
      }
      rememberOrder(items);
      clearBasket();
      setForm((current) => ({ ...current, notes: "" }));
      setOrderCode(data as string);
    } catch {
      setSubmitError("We couldn't reach the shop. Check your connection and try again. Your order has not been placed.");
      lock.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  const layerStyle = { zIndex: 60 + depth };

  if (orderCode) {
    return (
      <div className="fixed inset-0 overflow-y-auto bg-[var(--ivory)]" style={layerStyle} role="dialog" aria-modal="true" aria-labelledby="placed-heading">
        <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center px-6 py-16 text-center">
          <span className="bg-brand-tint text-brand-deep flex h-14 w-14 items-center justify-center rounded-full"><Check className="h-7 w-7" aria-hidden="true" /></span>
          <h1 id="placed-heading" className="mt-4 text-xl font-bold">Order placed</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">{storefrontName(shop.name)} has your order. Keep this code to check on it.</p>
          <p className="surface mt-5 px-6 py-3 font-mono text-3xl font-bold tracking-[0.2em]">{orderCode}</p>
          <div className="mt-6 flex w-full flex-col gap-2">
            <a href={`/s/${shop.slug}/status?code=${orderCode}`} className="btn-primary w-full">{t.checkStatus}</a>
            <button type="button" onClick={goHome} className="btn-outline h-12 w-full">Back to the shop</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-side fixed inset-0 overflow-y-auto overscroll-contain bg-[var(--ivory)]" style={layerStyle} role="dialog" aria-modal="true" aria-labelledby="checkout-heading">
      <form onSubmit={submit} noValidate>
        <div className="mx-auto max-w-2xl px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] sm:px-6">
          <div className="flex items-center gap-1 py-2">
            <button type="button" onClick={back} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-md" aria-label="Back to basket"><ArrowLeft className="h-6 w-6" aria-hidden="true" /></button>
            <h1 id="checkout-heading" className="text-lg font-bold">Checkout</h1>
          </div>

          <div className="space-y-5">
            <section aria-labelledby="how-heading">
              <h2 id="how-heading" className="mb-2 text-sm font-bold">How would you like it?</h2>
              <FulfilmentSwitch />
              <p className="mt-2 text-xs text-[var(--ink-soft)]">
                {fulfilment === "delivery" ? `Delivered within ${formatMoney(shop.delivery_radius_km)} km of the shop.` : `Collect from ${shop.address ?? "the shop"}.`}
              </p>
            </section>

            <section aria-labelledby="details-heading" className="surface space-y-4 p-4">
              <h2 id="details-heading" className="text-sm font-bold">{fulfilment === "delivery" ? "Delivery details" : "Your details"}</h2>
              <TextField id="checkout-name" label={t.name} error={errors.name}>
                <input id="checkout-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "checkout-name-error" : undefined} />
              </TextField>
              <TextField id="checkout-phone" label={t.mobile} hint="The shop calls this number if needed. You also use it to check your order." error={errors.phone}>
                <input id="checkout-phone" type="tel" inputMode="tel" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit mobile number" autoComplete="tel" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "checkout-phone-error" : "checkout-phone-hint"} />
              </TextField>
              {fulfilment === "delivery" && (
                <TextField id="checkout-address" label={t.address} error={errors.address}>
                  <textarea id="checkout-address" className="input min-h-20" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} autoComplete="street-address" placeholder="House, street, landmark" aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? "checkout-address-error" : undefined} />
                </TextField>
              )}
              <TextField id="checkout-notes" label="Note for the shop (optional)">
                <textarea id="checkout-notes" className="input min-h-16" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="For example, ring the bell twice" />
              </TextField>
            </section>

            <fieldset>
              <legend className="mb-2 text-sm font-bold">Payment</legend>
              <div className="grid grid-cols-2 gap-2">
                <PaymentTile icon={<Banknote className="h-5 w-5" aria-hidden="true" />} label="Cash" hint="Pay on arrival" checked={form.payment === "cod"} onChange={() => setForm({ ...form, payment: "cod" })} />
                <PaymentTile icon={<Smartphone className="h-5 w-5" aria-hidden="true" />} label="UPI" hint="Pay on arrival" checked={form.payment === "upi_on_delivery"} onChange={() => setForm({ ...form, payment: "upi_on_delivery" })} />
              </div>
            </fieldset>

            <section aria-labelledby="review-heading" className="surface p-4">
              <div className="flex items-center justify-between">
                <h2 id="review-heading" className="text-sm font-bold">Your order</h2>
                <button type="button" onClick={back} className="text-brand-deep -my-2 -mr-2 min-h-11 px-2 text-sm font-semibold">Edit</button>
              </div>
              <ul className="mt-1 space-y-1 text-sm">
                {basketProducts.map((product) => (
                  <li key={product.id} className="flex justify-between gap-3">
                    <span className="min-w-0 break-words text-[var(--ink-soft)]"><span className="font-semibold text-[var(--ink)]">{quantities[product.id]} ×</span> {product.name}</span>
                    <span className="shrink-0">₹{formatMoney(product.price * (quantities[product.id] ?? 0))}</span>
                  </li>
                ))}
              </ul>
            </section>

            <Bill title="Total" />

            <div>
              <label className="flex min-h-11 items-start gap-3 text-sm">
                <input id="checkout-terms" type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); if (e.target.checked) setErrors((current) => ({ ...current, terms: undefined })); }} aria-invalid={Boolean(errors.terms)} aria-describedby={errors.terms ? "checkout-terms-error" : undefined} />
                <span>{t.agreeToTermsPrefix} <Link href="/terms" target="_blank" className="font-semibold underline">{t.termsWord}</Link> and <Link href="/privacy" target="_blank" className="font-semibold underline">{t.privacyWord}</Link>.</span>
              </label>
              {errors.terms && <p id="checkout-terms-error" className="ml-8 text-sm font-semibold text-red-700">{errors.terms}</p>}
            </div>

            {(basketProducts.length === 0 || remaining > 0) && (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                {basketProducts.length === 0 ? "Your basket is empty." : `Add ₹${formatMoney(remaining)} more to reach the ₹${formatMoney(shop.min_order)} minimum.`}
              </p>
            )}
            {submitError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{submitError}</p>}
          </div>
        </div>

        {!typing && (
          <div className="fixed inset-x-0 bottom-0 border-t border-[var(--line)] bg-[var(--ivory)] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3" style={{ zIndex: 61 + depth }}>
            <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 sm:px-6">
              <div>
                <p className="text-xs text-[var(--ink-soft)]">To pay on arrival</p>
                <p className="text-xl font-bold leading-6">₹{formatMoney(total)}</p>
              </div>
              <button type="submit" disabled={submitting || basketProducts.length === 0 || remaining > 0} className="btn-primary flex-1 text-base" aria-busy={submitting}>
                {submitting ? t.placingOrder : t.placeOrder}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

function TextField({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-[var(--ink-soft)]">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}

function PaymentTile({ icon, label, hint, checked, onChange }: { icon: React.ReactNode; label: string; hint: string; checked: boolean; onChange: () => void }) {
  return (
    <label className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-[var(--radius)] border bg-white px-3.5 py-2.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--brand)] ${checked ? "border-brand shadow-[inset_0_0_0_1px_var(--brand)]" : "border-[var(--line-strong)]"}`}>
      <input type="radio" name="payment" checked={checked} onChange={onChange} className="sr-only" />
      <span className={checked ? "text-brand-deep" : "text-[var(--ink-soft)]"}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-[var(--ink-soft)]">{hint}</span>
      </span>
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${checked ? "border-brand" : "border-[var(--line-strong)]"}`} aria-hidden="true">
        {checked && <span className="bg-brand h-2.5 w-2.5 rounded-full" />}
      </span>
    </label>
  );
}
