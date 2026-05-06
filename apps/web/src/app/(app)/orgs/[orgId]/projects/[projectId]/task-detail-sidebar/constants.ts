import type { Column } from "@kanban/shared";

export const COLUMN_BADGE: Record<Column, string> = {
  ideas: "bg-purple-100 text-purple-700",
  todo: "bg-gray-100 text-gray-700",
  doing: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
};
