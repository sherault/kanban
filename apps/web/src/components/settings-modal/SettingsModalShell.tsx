import type { ReactNode } from "react";

export interface SettingsModalTab<T extends string> {
  id: T;
  label: string;
  danger?: boolean;
}

export function SettingsModalShell<T extends string>({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  tabs: SettingsModalTab<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const active = tabs.find((tab) => tab.id === activeTab);
  const isDanger = active?.danger ?? false;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[999] p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[600px] flex overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <aside className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
          <div className="p-6 border-b border-gray-200 bg-white">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              {title}
            </h2>
            <p className="text-xs text-gray-500 mt-1 truncate" title={subtitle}>
              {subtitle}
            </p>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? tab.danger
                      ? "bg-red-50 text-red-600 border border-red-100"
                      : "bg-white text-blue-600 shadow-sm border border-gray-200"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0 bg-white">
          <header className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
            <h3
              className={`text-lg font-semibold ${isDanger ? "text-red-600" : "text-gray-900"}`}
            >
              {active?.label}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
