// Netradyne driving-safety overlay. Server-side (reads the JSON snapshot pulled
// from the IDMS console). Matches Netradyne drivers to our roster by first+last
// name, since Netradyne uses short names and the scorecard uses full legal names.
import fs from "fs";
import path from "path";

let cache = null;

export function loadNetradyne() {
  if (cache) return cache;
  try {
    const p = path.join(process.cwd(), "data", "netradyne.json");
    cache = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    cache = { pulledAt: null, window: null, drivers: [] };
  }
  return cache;
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

// Key a name by its first and last token (ignores middle names).
function nameKey(name) {
  const t = norm(name).split(" ").filter(Boolean);
  if (!t.length) return "";
  return t.length === 1 ? t[0] : `${t[0]}|${t[t.length - 1]}`;
}

let index = null;
function buildIndex() {
  if (index) return index;
  index = new Map();
  for (const d of loadNetradyne().drivers || []) {
    index.set(nameKey(d.name), d);
  }
  return index;
}

// Return the safety counts for a roster driver name, or null if no match.
export function safetyForName(name) {
  const d = buildIndex().get(nameKey(name));
  if (!d) return null;
  return {
    backing: d.backing || 0,
    hardBraking: d.hardBraking || 0,
    following: d.following || 0,
    distraction: d.distraction || 0,
    drowsiness: d.drowsiness || 0,
    seatbelt: d.seatbelt || 0,
    highG: d.highG || 0,
    accel: d.accel || 0,
    signSignal: d.signSignal || 0,
    speeding: d.speeding || 0,
    thirdParty: d.thirdParty || 0,
    stars: d.star || 0,
    total: d.total || 0,
    netradyneName: d.name,
  };
}

export function safetyMeta() {
  const n = loadNetradyne();
  return { pulledAt: n.pulledAt, window: n.window, source: n.source };
}
