import type { ProjectDto } from "@kanban/shared";

export function ProjectGeneralTab({
  project,
  name,
  nameError,
  isPending,
  onNameChange,
  onSave,
}: {
  project: ProjectDto;
  name: string;
  nameError: string | null;
  isPending: boolean;
  onNameChange: (name: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Project name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
        {nameError && (
          <p className="text-xs text-red-600 font-medium">{nameError}</p>
        )}
        <div className="flex justify-end pt-2">
          <button
            onClick={onSave}
            disabled={isPending || name.trim() === "" || name === project.name}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm active:scale-95"
          >
            {isPending ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
        <h4 className="text-sm font-semibold text-gray-900 mb-1">
          Project Details
        </h4>
        <p className="text-xs text-gray-500 mb-4">
          Meta information about this project.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <p className="text-[10px] text-gray-400 uppercase font-bold spacing-wider">
              Created At
            </p>
            <p className="text-sm text-gray-700 font-medium">
              {new Date(project.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <p className="text-[10px] text-gray-400 uppercase font-bold spacing-wider">
              Project ID
            </p>
            <p className="text-[10px] text-gray-700 font-mono truncate">
              {project.id}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
