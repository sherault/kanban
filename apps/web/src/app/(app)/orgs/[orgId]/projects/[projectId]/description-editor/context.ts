import { createContext } from "react";

export interface DescriptionEditorContextType {
  onOpenTask?: (taskId: string) => void;
}

export const DescriptionEditorContext =
  createContext<DescriptionEditorContextType>({});
