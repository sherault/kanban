import type { ProjectDto } from "@kanban/shared";

export function ProjectDangerTab({
  project,
  confirmDeleteText,
  deleteError,
  isPending,
  onConfirmTextChange,
  onDelete,
}: {
  project: ProjectDto;
  confirmDeleteText: string;
  deleteError: string | null;
  isPending: boolean;
  onConfirmTextChange: (value: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="bg-red-50/50 border border-red-100 rounded-xl p-8 shadow-sm">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h4 className="text-lg font-bold text-red-900">Delete Project</h4>
            <p className="text-sm text-red-700 mt-1">
              This action is{" "}
              <strong className="font-black italic">permanent</strong> and
              cannot be undone. All tasks and data for{" "}
              <span className="font-bold">"{project.name}"</span> will be lost.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="projectConfirmDelete"
              className="block text-sm font-semibold text-red-900"
            >
              Type{" "}
              <span className="bg-red-200 px-1.5 py-0.5 rounded font-mono text-red-900">
                delete
              </span>{" "}
              to confirm
            </label>
            <input
              id="projectConfirmDelete"
              type="text"
              placeholder="delete"
              value={confirmDeleteText}
              onChange={(e) =>
                onConfirmTextChange(e.target.value.toLowerCase())
              }
              className="w-full bg-white border border-red-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-mono"
              autoComplete="off"
            />
          </div>

          <button
            onClick={onDelete}
            disabled={confirmDeleteText !== "delete" || isPending}
            className="w-full px-4 py-3 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-all shadow-md shadow-red-200 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {isPending ? "Deleting Project..." : "Permanently Delete Project"}
          </button>
        </div>
        {deleteError && (
          <p className="text-xs text-red-600 mt-4 font-bold">{deleteError}</p>
        )}
      </div>
    </div>
  );
}
