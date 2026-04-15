export const Column = {
  IDEAS: "ideas",
  TODO: "todo",
  DOING: "doing",
  DONE: "done",
} as const;

export type Column = (typeof Column)[keyof typeof Column];
