export function ProjectHydrationSkeleton() {
  return (
    <div className="flex h-full overflow-hidden">
      <aside className="w-56 bg-white border-r border-gray-200 shrink-0 h-full" />
      <div className="flex-1 overflow-hidden" />
    </div>
  );
}
