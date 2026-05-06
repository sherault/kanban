import { useCallback, useEffect, useRef, useState } from "react";
import type { ConflictInfo } from "./types";

export function useConflictField(externalValue: string) {
  const [value, setValue] = useState(externalValue);
  const [isFocused, setIsFocused] = useState(false);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [prevExternalValue, setPrevExternalValue] = useState(externalValue);
  const valueAtFocusRef = useRef(externalValue);
  const pendingWsRef = useRef<string | null>(null);

  if (externalValue !== prevExternalValue) {
    setPrevExternalValue(externalValue);
    if (!isFocused) setValue(externalValue || "");
  }

  useEffect(() => {
    if (isFocused) pendingWsRef.current = externalValue;
  }, [externalValue, isFocused]);

  const onFocus = useCallback(() => {
    setIsFocused(true);
    valueAtFocusRef.current = value;
    pendingWsRef.current = null;
  }, [value]);

  const onBlur = useCallback(() => {
    setIsFocused(false);
    const pendingWs = pendingWsRef.current;
    if (pendingWs !== null && pendingWs !== valueAtFocusRef.current) {
      if (value !== valueAtFocusRef.current) {
        setConflict({ ours: value, theirs: pendingWs });
      } else {
        setValue(pendingWs);
      }
    }
    pendingWsRef.current = null;
  }, [value]);

  const resolveConflict = useCallback(
    (choice: "ours" | "theirs") => {
      if (conflict && choice === "theirs") setValue(conflict.theirs);
      setConflict(null);
    },
    [conflict],
  );

  return { value, setValue, onFocus, onBlur, conflict, resolveConflict };
}
