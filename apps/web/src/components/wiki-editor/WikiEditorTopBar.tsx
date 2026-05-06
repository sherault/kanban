import type { SaveStatus, WikiEditorMode } from "./types";

export function WikiEditorTopBar({
  isConnected,
  status,
  mode,
  onModeChange,
  showProperties,
  onToggleProperties,
}: {
  isConnected: boolean;
  status: SaveStatus;
  mode: WikiEditorMode;
  onModeChange: (mode: WikiEditorMode) => void;
  showProperties: boolean;
  onToggleProperties: () => void;
}) {
  return (
    <div className="flex-none h-12 border-b border-gray-100 bg-white px-4 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-red-400"}`}
          />
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
            {isConnected ? "Live" : "Offline"}
          </span>
        </div>

        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
          <div
            className={`w-2 h-2 rounded-full transition-colors ${
              status === "saving"
                ? "bg-blue-500 animate-pulse"
                : status === "unsaved"
                  ? "bg-amber-400"
                  : "bg-gray-300"
            }`}
          />
          <span
            className={`text-[9px] font-black uppercase tracking-widest ${
              status === "saving"
                ? "text-blue-500"
                : status === "unsaved"
                  ? "text-amber-600"
                  : "text-gray-400"
            }`}
          >
            {status === "saving"
              ? "Saving"
              : status === "unsaved"
                ? "Unsaved"
                : "Saved"}
          </span>
        </div>
      </div>

      <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100">
        {(["view", "visual", "edit", "split"] as const).map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
              mode === m
                ? "bg-white text-blue-600 shadow-sm border border-gray-100"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <button
        onClick={onToggleProperties}
        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
          showProperties
            ? "bg-blue-50 text-blue-600 border border-blue-100"
            : "bg-gray-50 text-gray-400 border border-gray-100 hover:text-gray-600"
        }`}
      >
        {showProperties ? "Hide Details" : "Details"}
      </button>
    </div>
  );
}
