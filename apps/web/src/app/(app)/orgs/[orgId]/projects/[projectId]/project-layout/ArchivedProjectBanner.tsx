export function ArchivedProjectBanner({
  projectName,
}: {
  projectName: string;
}) {
  return (
    <div className="flex-none flex items-center gap-2 px-4 py-1.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
      <span className="font-bold uppercase tracking-wide text-[10px] bg-amber-100 px-2 py-0.5 rounded-full">
        Archived
      </span>
      <span className="truncate">
        "{projectName}" is archived. It stays editable — restore it from Project
        Settings → Danger Zone.
      </span>
    </div>
  );
}
