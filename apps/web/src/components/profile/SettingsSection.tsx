"use client";

import { useState } from "react";
import { updateSettingsAction } from "../../actions/profile";
import { useRouter } from "next/navigation";

interface Props {
  initialMaxOpenPanels: number;
  initialEnableNotifications: boolean;
  initialMaxNotifications: number;
  initialNotificationDuration: number;
}

export function SettingsSection({
  initialMaxOpenPanels,
  initialEnableNotifications,
  initialMaxNotifications,
  initialNotificationDuration,
}: Props) {
  const [maxPanels, setMaxPanels] = useState(initialMaxOpenPanels);
  const [enableNotifications, setEnableNotifications] = useState(
    initialEnableNotifications,
  );
  const [maxNotifications, setMaxNotifications] = useState(
    initialMaxNotifications,
  );
  const [notificationDuration, setNotificationDuration] = useState(
    initialNotificationDuration,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleUpdate = async (updates: {
    maxOpenPanels?: number;
    enableNotifications?: boolean;
    maxNotifications?: number;
    notificationDuration?: number;
  }) => {
    setSaving(true);
    setError(null);
    try {
      const res = await updateSettingsAction(updates);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (updates.maxOpenPanels !== undefined)
        setMaxPanels(updates.maxOpenPanels);
      if (updates.enableNotifications !== undefined)
        setEnableNotifications(updates.enableNotifications);
      if (updates.maxNotifications !== undefined)
        setMaxNotifications(updates.maxNotifications);
      if (updates.notificationDuration !== undefined)
        setNotificationDuration(updates.notificationDuration);
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
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
          onMouseUp={() => handleUpdate({ maxOpenPanels: maxPanels })}
          onTouchEnd={() => handleUpdate({ maxOpenPanels: maxPanels })}
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

      <div className="bg-white border border-gray-200 rounded-lg p-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Enable Live Notifications
          </label>
          <input
            type="checkbox"
            checked={enableNotifications}
            disabled={saving}
            onChange={(e) =>
              handleUpdate({ enableNotifications: e.target.checked })
            }
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>
        <p className="mt-1 text-xs text-gray-400 italic mb-4">
          Receive real-time notifications when tasks are updated.
        </p>

        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Max Notifications Displayed
          </label>
          <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
            {maxNotifications}
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="5"
          value={maxNotifications}
          onChange={(e) => setMaxNotifications(parseInt(e.target.value))}
          onMouseUp={() => handleUpdate({ maxNotifications })}
          onTouchEnd={() => handleUpdate({ maxNotifications })}
          disabled={saving}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 mb-4"
        />

        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Notification Duration (seconds)
          </label>
          <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
            {notificationDuration}s
          </span>
        </div>
        <input
          type="range"
          min="5"
          max="30"
          value={notificationDuration}
          onChange={(e) => setNotificationDuration(parseInt(e.target.value))}
          onMouseUp={() => handleUpdate({ notificationDuration })}
          onTouchEnd={() => handleUpdate({ notificationDuration })}
          disabled={saving}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>
    </section>
  );
}
