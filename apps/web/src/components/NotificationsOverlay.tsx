"use client";

import { useEffect, useState } from "react";

export interface NotificationData {
  id: string; // unique
  type: "task.created" | "task.updated" | "task.deleted";
  taskId?: string;
  message: string;
  duration: number; // in seconds
  isSelfMcp?: boolean;
}

export function NotificationsOverlay({
  notifications,
  maxNotifications,
  onClose,
  onClickTask,
  rightOffset = 0,
}: {
  notifications: NotificationData[];
  maxNotifications: number;
  onClose: (id: string) => void;
  onClickTask?: (taskId: string) => void;
  rightOffset?: number;
}) {
  // Stack oldest at bottom.
  // In `notifications` array, suppose the end is the newest.
  const displayNotifs = notifications.slice(-maxNotifications);

  return (
    <div
      className="absolute bottom-4 flex flex-col-reverse gap-2 pointer-events-none transition-[right] duration-300 ease-in-out z-50"
      style={{ right: `calc(1rem + ${rightOffset}px)` }}
    >
      {displayNotifs.map((n) => (
        <NotificationItem
          key={n.id}
          notification={n}
          onClose={onClose}
          onClickTask={onClickTask}
        />
      ))}
    </div>
  );
}

function NotificationItem({
  notification,
  onClose,
  onClickTask,
}: {
  notification: NotificationData;
  onClose: (id: string) => void;
  onClickTask?: (taskId: string) => void;
}) {
  const [timeLeft, setTimeLeft] = useState(notification.duration);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isHovered) return;
    if (timeLeft <= 0) {
      onClose(notification.id);
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isHovered, onClose, notification.id]);

  let bgColor = "bg-blue-500";
  if (notification.type === "task.deleted") bgColor = "bg-red-500";
  if (notification.type === "task.updated") bgColor = "bg-blue-500";
  if (notification.type === "task.created") bgColor = "bg-green-500";

  return (
    <div
      className={`pointer-events-auto rounded shadow-lg text-white p-3 pr-8 relative animate-in slide-in-from-right-8 duration-300 ${bgColor}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={() => onClose(notification.id)}
        className="absolute top-1 right-1 text-white hover:text-gray-200"
      >
        <svg
          className="w-4 h-4"
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
      <div className="text-sm font-medium">
        {notification.taskId && notification.type !== "task.deleted" ? (
          <button
            onClick={() => onClickTask?.(notification.taskId!)}
            className="text-left hover:underline focus:outline-none"
          >
            {notification.message}
          </button>
        ) : (
          notification.message
        )}
      </div>
      {notification.isSelfMcp && (
        <div className="text-[10px] uppercase tracking-wider font-bold opacity-60 mt-0.5">
          by your MCP client
        </div>
      )}
      <div className="text-xs opacity-75 mt-1">{timeLeft}s remaining</div>
    </div>
  );
}
