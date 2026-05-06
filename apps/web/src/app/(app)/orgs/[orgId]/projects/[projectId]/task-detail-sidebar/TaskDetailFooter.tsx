export function TaskDetailFooter({
  confirmDelete,
  isPending,
  onCancelDelete,
  onDelete,
}: {
  confirmDelete: boolean;
  isPending: boolean;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="px-5 py-4 border-t border-gray-200 shrink-0">
      {confirmDelete ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-600 flex-1">Delete this task?</span>
          <button
            onClick={onCancelDelete}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
          >
            Cancel
          </button>
          <button
            onClick={onDelete}
            disabled={isPending}
            className="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      ) : (
        <button
          onClick={onDelete}
          className="text-xs text-red-500 hover:text-red-700 transition-colors"
        >
          Delete task
        </button>
      )}
    </div>
  );
}
