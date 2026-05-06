export function parseTaskDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isDateOverdue(date: Date | null, now = new Date()) {
  return date != null && date < now;
}
