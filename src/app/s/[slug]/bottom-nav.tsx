import Link from "next/link";
import { ClipboardList, Home } from "lucide-react";

type Active = "home" | "orders";

const item = "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px]";
const on = "text-brand-deep font-bold";
const off = "font-medium text-stone-500";

/** Customer bottom navigation, shared by the shop and the order-status screens. */
export function BottomNav({ slug, active, onHome }: { slug: string; active: Active; onHome?: () => void }) {
  return (
    <nav aria-label="Main" className="border-t border-[var(--line)] bg-[var(--paper)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl">
        {onHome && active === "home" ? (
          <button type="button" onClick={onHome} aria-current="page" className={`${item} ${on}`}>
            <Home className="h-5 w-5" aria-hidden="true" />
            Home
          </button>
        ) : (
          <Link href={`/s/${slug}`} aria-current={active === "home" ? "page" : undefined} className={`${item} ${active === "home" ? on : off}`}>
            <Home className="h-5 w-5" aria-hidden="true" />
            Home
          </Link>
        )}
        <Link href={`/s/${slug}/status`} aria-current={active === "orders" ? "page" : undefined} className={`${item} ${active === "orders" ? on : off}`}>
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
          Orders
        </Link>
      </div>
    </nav>
  );
}
