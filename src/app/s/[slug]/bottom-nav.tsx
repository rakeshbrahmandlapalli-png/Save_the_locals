import Link from "next/link";
import { ClipboardList, Store, LayoutGrid } from "lucide-react";

type Active = "home" | "orders";

const item = "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px]";
const on = "text-brand-deep font-bold";
const off = "font-medium text-[var(--ink-soft)]";

/** Shop, existing catalogue browsing, and order lookup. */
export function BottomNav({ slug, active, onHome, onAisles, aislesActive = false }: { slug: string; active: Active; onHome?: () => void; onAisles?: () => void; aislesActive?: boolean }) {
  const marker = <span className="bg-brand-deep absolute top-0 h-0.5 w-8 rounded-b" aria-hidden="true" />;
  return (
    <nav aria-label="Main" className="bottom-navigation border-t border-[var(--line)] bg-[var(--ivory)] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-[1120px]">
        {onHome && active === "home" ? (
          <button type="button" onClick={onHome} aria-current={!aislesActive ? "page" : undefined} className={`relative ${item} ${aislesActive ? off : on}`}>
            {!aislesActive && marker}
            <Store className="h-5 w-5" aria-hidden="true" />
            Home
          </button>
        ) : (
          <Link href={`/s/${slug}`} aria-current={active === "home" ? "page" : undefined} className={`relative ${item} ${active === "home" ? on : off}`}>
            {active === "home" && marker}
            <Store className="h-5 w-5" aria-hidden="true" />
            Home
          </Link>
        )}
        {onAisles ? <button type="button" onClick={onAisles} aria-current={aislesActive ? "page" : undefined} className={`relative ${item} ${aislesActive ? on : off}`}>
          {aislesActive && marker}
          <LayoutGrid className="h-5 w-5" aria-hidden="true" />
          Aisles
        </button> : <Link href={`/s/${slug}?k=all`} className={`${item} ${off}`}><LayoutGrid className="h-5 w-5" aria-hidden="true" />Aisles</Link>}
        <Link href={`/s/${slug}/status`} aria-current={active === "orders" ? "page" : undefined} className={`relative ${item} ${active === "orders" ? on : off}`}>
          {active === "orders" && marker}
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
          Orders
        </Link>
      </div>
    </nav>
  );
}
