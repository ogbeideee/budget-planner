export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="flex items-center justify-between gap-3">
        <div className="h-7 w-44 animate-pulse rounded-md bg-border/70" />
        <div className="h-11 w-40 animate-pulse rounded-lg bg-border/70" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-lg bg-surface shadow-card"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-surface shadow-card" />
    </div>
  );
}
