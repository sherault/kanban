import type { ConflictInfo } from "./types";

export function ConflictModal({
  field,
  conflict,
  onResolve,
}: {
  field: string;
  conflict: ConflictInfo;
  onResolve: (choice: "ours" | "theirs") => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-96 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Conflict on <span className="italic">{field}</span>
        </h3>
        <p className="text-xs text-gray-500">
          This field was updated by someone else while you were editing it.
        </p>
        <div className="space-y-2">
          <ConflictVersion label="Your version" value={conflict.ours} />
          <ConflictVersion
            label="Their version"
            value={conflict.theirs}
            theirs
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => onResolve("ours")}
            className="text-xs px-3 py-1.5 rounded border border-gray-200 hover:border-gray-300 text-gray-700"
          >
            Keep mine
          </button>
          <button
            onClick={() => onResolve("theirs")}
            className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Accept theirs
          </button>
        </div>
      </div>
    </div>
  );
}

function ConflictVersion({
  label,
  value,
  theirs,
}: {
  label: string;
  value: string;
  theirs?: boolean;
}) {
  return (
    <div
      className={`rounded border p-3 ${
        theirs ? "border-amber-200 bg-amber-50" : "border-gray-200"
      }`}
    >
      <p
        className={`text-xs font-medium mb-1 ${
          theirs ? "text-amber-600" : "text-gray-400"
        }`}
      >
        {label}
      </p>
      <p className="text-sm text-gray-800 whitespace-pre-wrap">
        {value || <em className="text-gray-400">empty</em>}
      </p>
    </div>
  );
}
