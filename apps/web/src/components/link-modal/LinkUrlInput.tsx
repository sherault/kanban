import type { KeyboardEvent, RefObject } from "react";

export function LinkUrlInput({
  inputRef,
  url,
  onUrlChange,
  onSelect,
  onClose,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  url: string;
  onUrlChange: (url: string) => void;
  onSelect: (href: string) => void;
  onClose: () => void;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onSelect(url);
    if (e.key === "Escape") onClose();
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
        URL
      </label>
      <input
        ref={inputRef}
        type="text"
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        onKeyDown={onKeyDown}
        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        placeholder="https://example.com"
      />
    </div>
  );
}
