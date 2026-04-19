"use client";

import { useState } from "react";
import { api } from "../../../lib/api";
import { useRouter } from "next/navigation";

interface Props {
  initialMaxOpenPanels: number;
  token: string;
}

export function SettingsSection({ initialMaxOpenPanels, token }: Props) {
  const [maxPanels, setMaxPanels] = useState(initialMaxOpenPanels);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleUpdate = async (val: number) => {
    setSaving(true);
    setError(null);
    try {
      await api.auth.updateSettings(token, { maxOpenPanels: val });
      setMaxPanels(val);
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to update settings",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Preferences
        </h2>
        <p className="text-sm text-gray-500">
          Customize your experience on the Kanban board.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Maximum open task panels
          </label>
          <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
            {maxPanels}
          </span>
        </div>

        <input
          type="range"
          min="1"
          max="10"
          value={maxPanels}
          onChange={(e) => setMaxPanels(parseInt(e.target.value))}
          onMouseUp={() => handleUpdate(maxPanels)}
          onTouchEnd={() => handleUpdate(maxPanels)}
          disabled={saving}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />

        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-gray-400 font-medium">1</span>
          <span className="text-[10px] text-gray-400 font-medium">10</span>
        </div>

        <p className="mt-3 text-xs text-gray-400 italic">
          Limits the number of tasks that can be open simultaneously in the side
          panel stack.
        </p>

        {error && (
          <p className="mt-2 text-xs text-red-500 font-medium">{error}</p>
        )}
      </div>
    </section>
  );
}
