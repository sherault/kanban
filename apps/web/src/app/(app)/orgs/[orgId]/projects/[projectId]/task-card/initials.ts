export function getDisplayInitials(displayName?: string | null) {
  if (!displayName) return null;

  const initials = displayName
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || null;
}
