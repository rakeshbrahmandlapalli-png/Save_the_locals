import Link from "next/link";
import { ArrowRight, MapPin, QrCode, ShieldCheck, ShoppingBasket, Smartphone, Store, Truck } from "lucide-react";
import { createPublicClient } from "@/lib/supabase";
import { PLATFORM_NAME } from "@/lib/store-brand";

export const dynamic = "force-dynamic";

type ShopCard = { slug: string; name: string; address: string | null };

const isPlaceholder = (name: string) => /^placeholder\b/i.test(name);

/** The landing page must still render if the catalogue is unreachable, so a failure shows no shop list. */
async function loadShops(): Promise<ShopCard[]> {
  try {
    const { data, error } = await createPublicClient()
      .from("shops")
      .select("slug,name,address")
      .eq("active", true)
      .order("name")
      .returns<ShopCard[]>();
    return error ? [] : data;
  } catch {
    return [];
  }
}

const STEPS = [
  { icon: Smartphone, title: "Open your shop", text: "Scan the shop's QR code or open its link. No app store, no sign-up." },
  { icon: ShoppingBasket, title: "Fill your basket", text: "Search or browse the shop's own aisles and see the shop's real prices." },
  { icon: Truck, title: "Delivery or pickup", text: "Pay cash or UPI when it arrives. Track your order with its code." },
];

export default async function Home() {
  const shops = await loadShops();

  return (
    <div className="min-h-screen bg-[var(--ivory)] text-[var(--ink)]">
      <header className="mx-auto flex max-w-[1120px] items-center justify-between px-4 py-4 sm:px-6">
        <div className="brand-lockup"><ShoppingBasket className="h-7 w-7" aria-hidden="true" /><span className="!text-[17px]">{PLATFORM_NAME}</span></div>
        <nav aria-label="Main" className="flex items-center gap-4 text-sm font-medium text-[var(--ink-soft)]">
          <a href="#shops" className="hover:text-[var(--ink)]">Shops</a>
          <a href="#for-shops" className="hover:text-[var(--ink)]">For shop owners</a>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-[1120px] px-4 pb-12 pt-8 sm:px-6 sm:pt-16" aria-labelledby="hero">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-deep"><MapPin className="h-4 w-4" aria-hidden="true" />Neighbourhood shops, online</p>
          <h1 id="hero" className="max-w-2xl font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">Your neighbourhood essentials, right next door.</h1>
          <p className="mt-4 max-w-xl text-lg text-[var(--ink-soft)]">Order from the shop down your street: real prices, quick delivery or pickup, and the shopkeeper who knows you.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#shops" className="btn-primary">Find a shop <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
            <a href="#for-shops" className="btn-outline">I run a shop</a>
          </div>
        </section>

        <section className="bg-[var(--ivory-deep)] py-12" aria-labelledby="how">
          <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
            <h2 id="how" className="text-2xl font-extrabold tracking-tight">How it works</h2>
            <ol className="mt-6 grid gap-4 sm:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, text }, index) => (
                <li key={title} className="surface p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-tint text-brand-deep"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  <h3 className="mt-4 font-bold">{index + 1}. {title}</h3>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="shops" className="mx-auto max-w-[1120px] scroll-mt-4 px-4 py-12 sm:px-6" aria-labelledby="shops-title">
          <h2 id="shops-title" className="text-2xl font-extrabold tracking-tight">Shops open for orders</h2>
          {shops.length === 0 ? (
            <p className="surface mt-6 p-5 text-[var(--ink-soft)]">No shops are open for orders yet. If you have a shop&apos;s QR code or link, open that directly.</p>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shops.map((shop) => (
                <li key={shop.slug}>
                  <Link href={`/s/${shop.slug}`} className="surface flex h-full items-start justify-between gap-3 p-5 transition-colors hover:border-[var(--brand)]">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-bold"><Store className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" /><span className="truncate">{isPlaceholder(shop.name) ? "Demo store (sample data)" : shop.name}</span></span>
                      {shop.address && <span className="mt-1 block text-sm text-[var(--ink-soft)]">{shop.address}</span>}
                    </span>
                    <ArrowRight className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="for-shops" className="bg-[var(--ivory-deep)] py-12 scroll-mt-4" aria-labelledby="owners">
          <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
            <h2 id="owners" className="text-2xl font-extrabold tracking-tight">For shop owners</h2>
            <p className="mt-2 max-w-2xl text-[var(--ink-soft)]">Your own storefront on your own link, with your prices and your customers. Nobody else sees them.</p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-3">
              <li className="surface p-5"><Store className="h-5 w-5 text-brand" aria-hidden="true" /><h3 className="mt-3 font-bold">Manage orders and stock</h3><p className="mt-1 text-sm text-[var(--ink-soft)]">Confirm orders, update items and prices, and hide what is out of stock.</p></li>
              <li className="surface p-5"><QrCode className="h-5 w-5 text-brand" aria-hidden="true" /><h3 className="mt-3 font-bold">Print your QR poster</h3><p className="mt-1 text-sm text-[var(--ink-soft)]">Put it on the counter or pamphlets and see which one brings customers.</p></li>
              <li className="surface p-5"><ShieldCheck className="h-5 w-5 text-brand" aria-hidden="true" /><h3 className="mt-3 font-bold">Your customers stay yours</h3><p className="mt-1 text-sm text-[var(--ink-soft)]">Each shop&apos;s orders and customers are kept separate from every other shop.</p></li>
            </ul>
            <p className="mt-6 text-sm text-[var(--ink-soft)]">Already set up? <Link href="/admin" className="font-semibold text-brand-deep underline">Founder sign-in</Link>. Shop owners sign in from their own shop&apos;s owner page.</p>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-[1120px] px-4 py-8 text-sm text-[var(--ink-soft)] sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} {PLATFORM_NAME}</span>
          <nav aria-label="Legal" className="flex gap-4">
            <Link href="/privacy" className="hover:text-[var(--ink)]">Privacy</Link>
            <Link href="/terms" className="hover:text-[var(--ink)]">Terms</Link>
            <Link href="/refund-policy" className="hover:text-[var(--ink)]">Refunds</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
