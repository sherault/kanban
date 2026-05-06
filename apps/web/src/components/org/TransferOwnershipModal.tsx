import type { MembershipDto } from "@kanban/shared";

export function TransferOwnershipModal({
  target,
  isPending,
  onCancel,
  onConfirm,
}: {
  target: MembershipDto | undefined;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[210] p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 space-y-6 animate-in zoom-in-95 duration-200 border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 text-amber-600">
          <div className="bg-amber-100 p-2 rounded-full">
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900">
            Transfer ownership
          </h3>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          Are you sure you want to transfer ownership to{" "}
          <strong className="text-gray-900">{target?.user.displayName}</strong>?
          <br />
          <br />
          You will become a <strong className="text-gray-900">
            manager
          </strong>{" "}
          and lose full administrative privileges over the organization.
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-6 py-2 text-sm font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 shadow-sm shadow-amber-100 disabled:opacity-50 transition-all active:scale-95"
          >
            Transfer
          </button>
        </div>
      </div>
    </div>
  );
}
