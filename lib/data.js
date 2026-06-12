import fs from "fs";
import path from "path";

let cache = null;

export function loadData() {
  if (cache) return cache;
  const p = path.join(process.cwd(), "data", "data.json");
  try {
    cache = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    cache = {
      generatedAt: null,
      weekly: {},
      daily: {},
      trailing6: [],
      details: { dcr: {}, dsb: {}, pod: {}, cdf: {} },
      events: { feedback: [], concessions: [], rts: [] },
      station: { weeks: [], metrics: [] },
      sourceFiles: [],
    };
  }
  return cache;
}

// ---------- fuzzy field access ----------
export function pick(obj, ...cands) {
  if (!obj) return undefined;
  const keys = Object.keys(obj);
  for (const cand of cands) {
    const c = cand.toLowerCase();
    const exact = keys.find((k) => k.toLowerCase() === c);
    if (exact) return obj[exact];
  }
  for (const cand of cands) {
    const c = cand.toLowerCase();
    const part = keys.find((k) => k.toLowerCase().includes(c));
    if (part) return obj[part];
  }
  return undefined;
}

export function num(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/[%,]/g, "").trim();
  if (s === "" || /^(no data|n\/a|--|-)$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function fmt(v, suffix = "") {
  if (v === null || v === undefined) return "—";
  return (
    (typeof v === "number"
      ? v % 1 === 0
        ? v.toLocaleString()
        : v.toFixed(2)
      : v) + suffix
  );
}

// ---------- weeks ----------
export function latestWeek(data = loadData()) {
  const weeks = Object.keys(data.weekly).filter((w) => /\d{4}-W\d+/.test(w));
  weeks.sort();
  // Prefer the latest week that has the full scorecard (overview) export —
  // the current week often only has partial delivery data.
  const withOverview = weeks.filter((w) => data.weekly[w]?.overview);
  return withOverview[withOverview.length - 1] || weeks[weeks.length - 1] || null;
}

export function allWeeks(data = loadData()) {
  return Object.keys(data.weekly)
    .filter((w) => /\d{4}-W\d+/.test(w))
    .sort();
}

// ---------- drivers ----------
function driverKey(row) {
  return (
    pick(row, "transporter id", "transporter_id", "delivery associate id", "da id") ||
    pick(row, "delivery associate", "delivery associate name", "name") ||
    "unknown"
  );
}

function driverName(row) {
  return (
    pick(row, "delivery associate name", "delivery associate", "name") ||
    "Unknown"
  );
}

// Merge all weekly tables for one week into per-driver records.
export function driversForWeek(week, data = loadData()) {
  const wk = data.weekly[week] || {};
  const map = new Map();
  const sources = [
    wk.overview,
    wk.quality,
    wk.delivery,
    data.details?.dcr?.[week],
  ].filter(Boolean);
  for (const rows of sources) {
    for (const row of rows) {
      const id = driverKey(row);
      if (!map.has(id))
        map.set(id, { id, name: driverName(row), rows: [] });
      const d = map.get(id);
      d.rows.push(row);
      if (d.name === "Unknown") d.name = driverName(row);
    }
  }
  return [...map.values()].map((d) => normalizeDriver(d, week, data));
}

function firstNum(rows, ...cands) {
  for (const r of rows) {
    const v = num(pick(r, ...cands));
    if (v !== null) return v;
  }
  return null;
}

function firstStr(rows, ...cands) {
  for (const r of rows) {
    const v = pick(r, ...cands);
    if (v !== undefined && v !== "" && !/^(--|-)$/.test(v)) return v;
  }
  return null;
}

export function normalizeDriver(d, week, data = loadData()) {
  const rows = d.rows;
  const overall = firstNum(rows, "overall score");
  const tierText = firstStr(rows, "overall standing");
  const delivered = firstNum(rows, "packages delivered", "delivered packages", "delivered");
  const dcr = firstNum(rows, "dcr");
  const dsb = firstNum(rows, "dsb dpmo", "dsb");
  const pod = firstNum(rows, "pod");
  const cdf = firstNum(rows, "cdf dpmo", "cdf");
  const ced = firstNum(rows, "ced");
  const rtsCount = firstNum(rows, "packages returned to station (rts)", "rts count", "packages returned");
  const rtsPct = firstNum(rows, "packages returned to station (rts) %", "rts %");
  const rtsDpmo = firstNum(rows, "return to station dpmo", "rts dpmo");

  // events
  const evts = driverEvents(d.id, d.name, data);

  return {
    id: d.id,
    name: d.name,
    week,
    overall,
    tierText,
    delivered,
    dcr,
    dsb,
    pod,
    cdf,
    ced,
    rtsCount,
    rtsPct,
    rtsDpmo,
    feedbackCount: evts.feedback.length,
    concessionCount: evts.concessions.length,
    rtsEventCount: evts.rts.length,
    raw: rows,
  };
}

export function driverEvents(id, name, data = loadData()) {
  const match = (e) => {
    const ids = [
      pick(e, "transporter id", "transporter_id"),
      pick(e, "delivery associate id"),
      pick(e, "delivery associate"),
    ].filter(Boolean);
    if (ids.includes(id)) return true;
    const ename = pick(e, "delivery associate name", "delivery associate", "name");
    return ename && name && ename.toLowerCase() === name.toLowerCase();
  };
  return {
    feedback: data.events.feedback.filter(match),
    concessions: data.events.concessions.filter(match),
    rts: data.events.rts.filter(match),
  };
}

// Composite ranking score: higher = better. Uses overall score when present,
// otherwise builds from DCR/POD minus defect signals.
export function rankScore(d) {
  if (d.overall !== null && d.overall !== undefined) return d.overall;
  let s = 0;
  if (d.dcr !== null) s += d.dcr * 0.5;
  if (d.pod !== null) s += d.pod * 0.3;
  s -= (d.cdf || 0) / 100;
  s -= (d.feedbackCount || 0) * 2;
  s -= (d.concessionCount || 0) * 2;
  s -= (d.rtsEventCount || 0) * 1;
  return s;
}

export function tierClass(t) {
  const s = (t || "").toLowerCase();
  if (s.includes("platinum")) return "platinum";
  if (s.includes("gold")) return "gold";
  if (s.includes("silver")) return "silver";
  if (s.includes("bronze")) return "bronze";
  return "neutral";
}

// Breez tier scale — computed from the score, not Amazon's label.
// Platinum ≥98 · Gold 90+ · Silver 80+ · Bronze 70+ · At Risk <70.
import { scoreTier } from "./tiers";

export function effectiveTier(d) {
  return scoreTier(d?.overall ?? null, d?.tierText || null);
}

export function metricTier(value, kind) {
  if (value === null || value === undefined) return ["No Data", "tier-nodata"];
  switch (kind) {
    case "dcr":
      if (value >= 99.5) return ["Fantastic", "tier-fantastic"];
      if (value >= 99.0) return ["Great", "tier-great"];
      if (value >= 98.0) return ["Fair", "tier-fair"];
      return ["Poor", "tier-poor"];
    case "pod":
      if (value >= 98.0) return ["Fantastic", "tier-fantastic"];
      if (value >= 97.0) return ["Great", "tier-great"];
      if (value >= 95.0) return ["Fair", "tier-fair"];
      return ["Poor", "tier-poor"];
    case "cdf":
      if (value === 0) return ["Fantastic", "tier-fantastic"];
      if (value < 1100) return ["Great", "tier-great"];
      if (value < 2300) return ["Fair", "tier-fair"];
      return ["Poor", "tier-poor"];
    default:
      return ["", ""];
  }
}
