import { useSyncExternalStore } from "react";

function subscribeToHydration() {
  return () => {};
}

export function useHydrated() {
  return useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
}
