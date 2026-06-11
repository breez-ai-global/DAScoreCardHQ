// Builds data/data.json from the raw CSVs exported from the Amazon Logistics
// DSP portal. Drop CSVs in <repo>/../data/raw (or app/data/raw) and run.
// Files are classified by their header signature, so exact filenames don't matter.
import fs from "fs";
import path from "path";

const APP_DIR = process.cwd();
const CANDIDATE_DIRS = [
  path.join(APP_DIR, "data", "raw"),
  path.join(APP_DIR, "..", "data", "raw"),
];
const OUT = path.join(APP_DIR, "data", "data.json");

// ---------- CSV parsing (handles quotes, commas, newlines in fields) ----------
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((f) => f.trim() !== "")) rows.push(row);
  }
  return rows;
}

function toObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.replace(/^﻿/, "").trim());
  return rows.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    return o;
  });
}

// ---------- classification by header signature ----------
function classify(headers, filename) {
  const h = headers.map((x) => x.toLowerCase().replace(/^﻿/, ""));
  const has = (...keys) => keys.every((k) => h.some((x) => x.includes(k)));
  const fname = filename.toLowerCase();

  if (has("da selected rts code")) return "rts_events";
  if (has("concession date") || has("concession", "tracking")) return "concession_events";
  if (has("da mishandled package") || has("never received delivery")) return "feedback_events";
  if (has("overall score") || (has("fico") && has("dcr"))) return "da_overview";
  if (has("metric") && has("week")) return "station_weeks";
  if (has("delivery associate") && (has("delivered not received") || has("dnr") || has("return to station dpmo")))
    return "da_delivery";
  if (has("delivered not received")) return "station_metrics";
  if (has("cdf dpmo") && (has("packages delivered") || has("delivered"))) return "quality_overview";
  if (has("dcr") && has("pod")) return "quality_overview";
  if (has("pod acceptance")) return "pod_detail";
  if (has("delivery completion rate") || (has("dcr") && has("rts"))) return "dcr_detail";
  if (has("dsb") || has("delivery success")) return "dsb_detail";
  if (has("cdf") || fname.includes("feedback")) return "cdf_detail";
  return "unknown";
}

// Date/week tagging from filename, e.g. "...2026-W23..." or "...2026-06-03..."
function tagFromFilename(fname) {
  const wk = fname.match(/(\d{4})[-_ ]?w(?:eek)?[-_ ]?(\d{1,2})/i);
  if (wk) return { week: `${wk[1]}-W${wk[2].padStart(2, "0")}` };
  const d = fname.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (d) return { date: `${d[1]}-${d[2]}-${d[3]}` };
  const us = fname.match(/(\d{2})[-_](\d{2})[-_](\d{4})/);
  if (us) return { date: `${us[3]}-${us[1]}-${us[2]}` };
  return {};
}

// ---------- main ----------
const dir = CANDIDATE_DIRS.find((d) => fs.existsSync(d));
const files = dir
  ? fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".csv"))
  : [];

// If no raw CSVs are present (e.g. building on Vercel where only data.json is
// shipped), keep the existing data.json instead of overwriting it with nothing.
if (!files.length && fs.existsSync(OUT)) {
  console.log("build-data: no raw CSVs found, keeping existing data.json");
  process.exit(0);
}

const out = {
  generatedAt: new Date().toISOString(),
  sourceFiles: [],
  weekly: {},
  daily: {},
  trailing6: [],
  details: { dcr: {}, dsb: {}, pod: {}, cdf: {} },
  events: { feedback: [], concessions: [], rts: [] },
  station: { weeks: [], metrics: [] },
  unknown: [],
};

const seenEvent = new Set();

for (const f of files) {
  const text = fs.readFileSync(path.join(dir, f), "utf8");
  const rows = parseCSV(text);
  if (!rows.length) continue;
  const objs = toObjects(rows);
  const kind = classify(rows[0], f);
  const tag = tagFromFilename(f);
  out.sourceFiles.push({ file: f, kind, rows: objs.length, ...tag });

  const lower = f.toLowerCase();
  switch (kind) {
    case "da_overview": {
      if (lower.includes("trailing") || lower.includes("6-week") || lower.includes("6week")) {
        out.trailing6 = objs;
      } else {
        const wk = tag.week || "unknown-week";
        out.weekly[wk] = out.weekly[wk] || {};
        out.weekly[wk].overview = objs;
      }
      break;
    }
    case "quality_overview": {
      if (tag.date) {
        out.daily[tag.date] = objs;
      } else {
        const wk = tag.week || "unknown-week";
        out.weekly[wk] = out.weekly[wk] || {};
        out.weekly[wk].quality = objs;
      }
      break;
    }
    case "dcr_detail":
    case "dsb_detail":
    case "pod_detail":
    case "cdf_detail": {
      const key = kind.split("_")[0];
      const wk = tag.week || tag.date || "unknown";
      out.details[key][wk] = objs;
      break;
    }
    case "feedback_events":
    case "concession_events":
    case "rts_events": {
      const bucket =
        kind === "feedback_events"
          ? out.events.feedback
          : kind === "concession_events"
          ? out.events.concessions
          : out.events.rts;
      for (const o of objs) {
        const id =
          kind +
          "::" +
          (o["Tracking ID"] || o["Tracking Id"] || JSON.stringify(o));
        if (seenEvent.has(id)) continue;
        seenEvent.add(id);
        bucket.push(o);
      }
      break;
    }
    case "station_weeks":
      out.station.weeks = objs;
      break;
    case "station_metrics":
      out.station.metrics.push({ ...tag, rows: objs });
      break;
    case "da_delivery": {
      const wk = tag.week || "unknown-week";
      out.weekly[wk] = out.weekly[wk] || {};
      out.weekly[wk].delivery = objs;
      break;
    }
    default:
      out.unknown.push({ file: f, headers: rows[0] });
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(
  `build-data: ${files.length} csvs from ${dir || "(none)"} -> ${OUT}`
);
console.log(
  out.sourceFiles.map((s) => `  [${s.kind}] ${s.file} (${s.rows})`).join("\n")
);
