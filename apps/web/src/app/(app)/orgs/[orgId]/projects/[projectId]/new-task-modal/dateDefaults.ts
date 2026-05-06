export function formatDateInput(date: Date) {
  return date.toISOString().split("T")[0];
}

export function today(now = new Date()) {
  return formatDateInput(now);
}

export function daysFromToday(days: number, now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
}

export function todayPlus2(now = new Date()) {
  return daysFromToday(2, now);
}
