interface NewTaskHeaderProps {
  onClose: () => void;
}

export function NewTaskHeader({ onClose }: NewTaskHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
      <h2 className="text-base font-semibold text-gray-900">New task</h2>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 text-xl leading-none"
      >
        x
      </button>
    </div>
  );
}
