import { Column } from "@kanban/shared";

export const BOARD_COLUMNS: { id: Column; label: string }[] = [
  { id: Column.IDEAS, label: "Ideas" },
  { id: Column.TODO, label: "To Do" },
  { id: Column.DOING, label: "Doing" },
  { id: Column.DONE, label: "Done" },
];
