import Link from "next/link";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-white px-4 py-10 text-slate-950">
      <Link href="/" className="text-sm font-semibold text-slate-500">← Back</Link>
      <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
        Draft placeholder — not yet reviewed by an Indian legal professional.
      </p>
      <h1 className="mt-4 text-2xl font-bold">{title}</h1>
      <div className="mt-6 space-y-4 text-sm leading-6 text-slate-700 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-slate-950">
        {children}
      </div>
    </main>
  );
}
