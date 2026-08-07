export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-hidden="true">
      <div className="flex items-end justify-between gap-3">
        <div className="skeleton h-12 w-52 rounded-md" />
        <div className="skeleton h-11 w-44 rounded-md" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="skeleton h-[152px] rounded-xl" />
        ))}
      </div>
      <div className="skeleton h-72 rounded-xl" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="skeleton h-64 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    </div>
  );
}
