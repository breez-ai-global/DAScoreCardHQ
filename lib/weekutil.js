// Pure, client-safe week math. Amazon-style Sun→Sat weeks, anchored Week 24 = Jun 7 2026.
const DAY = 864e5;
const ANCHOR_MS = Date.UTC(2026, 5, 7);
const ANCHOR_WEEK = 24;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isoOf(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function weekOfDate(iso) {
  const d = (iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const ms = Date.parse(d + "T00:00:00Z");
  const wk = ANCHOR_WEEK + Math.floor((ms - ANCHOR_MS) / (7 * DAY));
  return `2026-W${String(wk).padStart(2, "0")}`;
}

export function weekWindow(week) {
  const m = /W(\d+)/.exec(week || "");
  if (!m) return null;
  const start = ANCHOR_MS + (Number(m[1]) - ANCHOR_WEEK) * 7 * DAY;
  return { start: isoOf(start), end: isoOf(start + 6 * DAY) };
}

export function weekTitle(week) {
  const w = weekWindow(week);
  const n = /W(\d+)/.exec(week)?.[1];
  if (!w) return week;
  const [, smo, sda] = w.start.split("-");
  const [, emo, eda] = w.end.split("-");
  const startLabel = `${MONTHS[+smo - 1]} ${+sda}`;
  const endLabel = smo === emo ? `${+eda}` : `${MONTHS[+emo - 1]} ${+eda}`;
  return `Week ${n} (${startLabel}–${endLabel})`;
}
