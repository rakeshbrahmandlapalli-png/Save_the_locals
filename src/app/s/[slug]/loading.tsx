export default function Loading() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-white px-4 py-8" aria-busy="true">
      <div className="h-8 w-52 animate-pulse rounded bg-slate-200" />
      <div className="mt-8 h-11 animate-pulse rounded-xl bg-slate-100" />
      <div className="mt-8 grid grid-cols-2 gap-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-44 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    </main>
  );
}
