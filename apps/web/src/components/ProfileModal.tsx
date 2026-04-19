"use client";

import { useEffect, useState, useTransition } from "react";
import { getProfileDataAction } from "@/actions/profile";
import { TotpSection } from "./profile/TotpSection";
import { ApiKeysSection } from "./profile/ApiKeysSection";
import { SettingsSection } from "./profile/SettingsSection";
import { ResendVerificationButton } from "./profile/ResendVerificationButton";
import type { ApiKeyDto, UserDto } from "@kanban/shared";

interface ProfileData {
  displayName: string;
  keys: ApiKeyDto[];
  me: UserDto;
  token: string;
  publicApiUrl: string;
}

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [activeTab, setActiveTab] = useState<"account" | "preferences" | "mcp">(
    "account",
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getProfileDataAction();
      if (result) {
        setData(result);
      }
    });
  }, []);

  // Close on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!data && isPending) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[600px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const tabs = [
    { id: "account" as const, label: "Account" },
    { id: "preferences" as const, label: "Preferences" },
    { id: "mcp" as const, label: "MCP API Keys" },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[200] p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[600px] flex overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
          <div className="p-6 border-b border-gray-200 bg-white">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              Profile
            </h2>
            <p
              className="text-xs text-gray-500 mt-1 truncate"
              title={data.displayName}
            >
              {data.displayName}
            </p>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-white text-blue-600 shadow-sm border border-gray-200"
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
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          <header className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {tabs.find((t) => t.id === activeTab)?.label}
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
            {activeTab === "account" && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Email verification banner */}
                {!data.me.emailVerified && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="bg-amber-100 p-2 rounded-full">
                        <svg
                          className="w-5 h-5 text-amber-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                      </div>
                      <p className="text-sm text-amber-800">
                        Your email address is not verified. Check your inbox.
                      </p>
                    </div>
                    <ResendVerificationButton />
                  </div>
                )}

                <TotpSection totpEnabled={data.me.totpEnabled} />
              </div>
            )}

            {activeTab === "preferences" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <SettingsSection
                  initialMaxOpenPanels={data.me.maxOpenPanels}
                  token={data.token}
                />
              </div>
            )}

            {activeTab === "mcp" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <section>
                  <p className="text-sm text-gray-500 mb-6">
                    Use these keys to authenticate Claude (or other MCP clients)
                    with your Kanban board.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Streamable HTTP (recommended)
                      </p>
                      <div className="relative group">
                        <pre className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 text-xs font-mono text-gray-300 overflow-x-auto leading-relaxed shadow-lg">{`{
  "mcpServers": {
    "kanban": {
      "type": "http",
      "url": "${data.publicApiUrl}/mcp/",
      "headers": { "Authorization": "Bearer <your-key>" }
    }
  }
}`}</pre>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Legacy SSE (older clients)
                      </p>
                      <pre className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 text-xs font-mono text-gray-300 overflow-x-auto leading-relaxed shadow-lg">{`{
  "mcpServers": {
    "kanban": {
      "type": "sse",
      "url": "${data.publicApiUrl}/mcp/sse",
      "headers": { "Authorization": "Bearer <your-key>" }
    }
  }
}`}</pre>
                    </div>
                  </div>

                  <div className="mt-10 pt-8 border-t border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-900 mb-4">
                      Manage Keys
                    </h4>
                    <ApiKeysSection initialKeys={data.keys} />
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
