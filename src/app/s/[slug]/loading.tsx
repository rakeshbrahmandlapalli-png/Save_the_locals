export default function Loading() {
  const block = "animate-pulse rounded-md bg-[var(--ivory-deep)]";
  return (
    <main className="mx-auto min-h-screen max-w-[1120px] bg-[var(--ivory)] px-4 pt-4 sm:px-6" aria-busy="true" aria-label="Loading the shop">
      <div className={`${block} h-5 w-40`} />
      <div className={`${block} mt-2 h-6 w-32`} />
      <div className={`${block} mt-2 h-4 w-56`} />
      <div className={`${block} mt-4 h-12`} />
      <div className="mt-5 grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className={`${block} h-[5.25rem]`} />)}
      </div>
      <div className="mt-6 flex gap-2.5 overflow-hidden">
        {Array.from({ length: 3 }).map((_, index) => <div key={index} className={`${block} h-60 w-[9.25rem] shrink-0`} />)}
      </div>
    </main>
  );
}
