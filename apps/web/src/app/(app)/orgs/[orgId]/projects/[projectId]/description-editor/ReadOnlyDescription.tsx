import { DescriptionEditorContext } from "./context";
import { DescriptionPreview } from "./DescriptionPreview";

export function ReadOnlyDescription({
  value,
  placeholder,
  onOpenTask,
  onStartEditing,
  onToggleFullscreen,
}: {
  value: string;
  placeholder: string;
  onOpenTask?: (taskId: string) => void;
  onStartEditing: () => void;
  onToggleFullscreen: () => void;
}) {
  return (
    <DescriptionEditorContext.Provider value={{ onOpenTask }}>
      <div className="group relative">
        <div className="min-h-[60px] rounded border border-transparent hover:border-gray-200 px-2 py-1.5">
          <DescriptionPreview value={value} placeholder={placeholder} />
        </div>
        <div className="absolute top-1 right-1 hidden group-hover:flex items-center gap-1">
          <button
            onClick={onStartEditing}
            className="px-1.5 py-0.5 text-xs bg-white border border-gray-200 rounded text-gray-500 shadow-sm"
          >
            Edit
          </button>
          <button
            onClick={onToggleFullscreen}
            className="px-1.5 py-0.5 text-xs bg-white border border-gray-200 rounded text-gray-500 shadow-sm"
          >
            ⤢
          </button>
        </div>
      </div>
    </DescriptionEditorContext.Provider>
  );
}
