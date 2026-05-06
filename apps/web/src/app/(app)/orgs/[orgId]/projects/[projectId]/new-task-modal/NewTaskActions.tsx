import { SubmitButton } from "./SubmitButton";

interface NewTaskActionsProps {
  onClose: () => void;
}

export function NewTaskActions({ onClose }: NewTaskActionsProps) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onClose}
        className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
      >
        Cancel
      </button>
      <SubmitButton />
    </div>
  );
}
