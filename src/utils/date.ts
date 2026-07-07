const DAY_MS = 24 * 60 * 60 * 1000;

export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateKey: string, days: number): string {
  return new Date(new Date(dateKey).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function daysBetween(fromIso?: string, to = new Date()): number {
  if (!fromIso) return Number.POSITIVE_INFINITY;
  return Math.floor((to.getTime() - new Date(fromIso).getTime()) / DAY_MS);
}

export function formatDate(dateKey?: string): string {
  if (!dateKey) return "Not set";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateKey}T12:00:00`));
}

export function weekStartKey(date = new Date()): string {
  const local = new Date(date);
  const day = local.getDay();
  const diff = local.getDate() - day + (day === 0 ? -6 : 1);
  local.setDate(diff);
  return todayKey(local);
}

export function isThisWeek(dateKey: string): boolean {
  const start = new Date(`${weekStartKey()}T00:00:00`).getTime();
  const end = start + 7 * DAY_MS;
  const value = new Date(`${dateKey}T12:00:00`).getTime();
  return value >= start && value < end;
}
