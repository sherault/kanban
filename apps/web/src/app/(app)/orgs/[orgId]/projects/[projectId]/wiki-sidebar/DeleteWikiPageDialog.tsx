"use client";

interface DeleteWikiPageDialogProps {
  title: string;
  descendantCount: number;
  isDeleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteWikiPageDialog({
  title,
  descendantCount,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: DeleteWikiPageDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Delete ${title}`}
        className="w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-200 p-6"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
      >
        <h3 className="text-lg font-bold text-gray-900">Delete page</h3>
        <p className="mt-2 text-sm text-gray-600">
          <span className="font-semibold text-gray-900">"{title}"</span> will be
          permanently deleted, along with its edit history. This cannot be
          undone.
        </p>
        {descendantCount > 0 && (
          <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {descendantCount} nested {descendantCount === 1 ? "page" : "pages"}{" "}
            will be deleted too.
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            autoFocus
            className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete page"}
          </button>
        </div>
      </div>
    </div>
  );
}
