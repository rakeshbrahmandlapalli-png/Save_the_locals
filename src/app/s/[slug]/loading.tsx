export default function Loading() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-[var(--paper)] px-4 pt-4" aria-busy="true" aria-label="Loading shop">
      <div className="h-7 w-56 animate-pulse rounded-lg bg-stone-200" />
      <div className="mt-2 h-4 w-44 animate-pulse rounded bg-stone-200" />
      <div className="mt-3 h-11 animate-pulse rounded-full bg-stone-200" />
      <div className="mt-3 h-12 animate-pulse rounded-xl bg-stone-200" />
      <div className="mt-4 flex gap-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-16 w-14 shrink-0 animate-pulse rounded-full bg-stone-200" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index}>
            <div className="aspect-[4/3] animate-pulse rounded-xl bg-stone-200" />
            <div className="mt-2 h-10 animate-pulse rounded bg-stone-200" />
            <div className="mt-2 h-11 animate-pulse rounded-lg bg-stone-200" />
          </div>
        ))}
      </div>
    </main>
  );
}
