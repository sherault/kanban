"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import type { ReactNode } from "react";
import type { WikiPageSummaryDto } from "@kanban/shared";

interface WikiContextType {
  pages: WikiPageSummaryDto[];
  setPages: (pages: WikiPageSummaryDto[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  pageModes: Record<string, "edit" | "view" | "split" | "visual">;
  setPageMode: (
    pageId: string,
    mode: "edit" | "view" | "split" | "visual",
  ) => void;
  pageContents: Record<string, string>;
  setPageContent: (pageId: string, content: string) => void;
  pageProperties: Record<string, Record<string, any>>;
  setPageProperties: (pageId: string, properties: Record<string, any>) => void;
}

const WikiContext = createContext<WikiContextType | undefined>(undefined);

export function WikiProvider({ children }: { children: ReactNode }) {
  const [pages, setPages] = useState<WikiPageSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pageModes, setPageModes] = useState<
    Record<string, "edit" | "view" | "split" | "visual">
  >({});
  const [pageContents, setPageContents] = useState<Record<string, string>>({});
  const [pageProperties, setPagePropertiesState] = useState<
    Record<string, Record<string, any>>
  >({});

  const setPageMode = useCallback(
    (pageId: string, mode: "edit" | "view" | "split" | "visual") => {
      setPageModes((prev) => ({ ...prev, [pageId]: mode }));
    },
    [],
  );

  const setPageContent = useCallback((pageId: string, content: string) => {
    setPageContents((prev) => ({ ...prev, [pageId]: content }));
  }, []);

  const setPageProperties = useCallback(
    (pageId: string, properties: Record<string, any>) => {
      setPagePropertiesState((prev) => ({ ...prev, [pageId]: properties }));
    },
    [],
  );

  const value = useMemo(
    () => ({
      pages,
      setPages,
      isLoading,
      setIsLoading,
      pageModes,
      setPageMode,
      pageContents,
      setPageContent,
      pageProperties,
      setPageProperties,
    }),
    [
      pages,
      isLoading,
      pageModes,
      setPageMode,
      pageContents,
      setPageContent,
      pageProperties,
      setPageProperties,
    ],
  );

  return <WikiContext.Provider value={value}>{children}</WikiContext.Provider>;
}

export function useWiki() {
  const context = useContext(WikiContext);
  if (!context) {
    throw new Error("useWiki must be used within a WikiProvider");
  }
  return context;
}
