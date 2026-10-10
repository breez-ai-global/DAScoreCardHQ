// Amazon DSP Weekly Scorecard — reverse-engineered scoring model.
// Client-safe (no fs imports). Used by the main-app "Scorecard Anatomy" page
// and the standalone /scorecard-planner tool.
//
// ── How the real scorecard works (reverse-engineered from live scorecards) ──
//
//  Layer 1 (raw → metric sub-score):  Each metric's raw number is mapped onto a
//    0–100 sub-score by a CONTINUOUS, piecewise-linear function anchored at the
//    tier thresholds. It is NOT a step function — a scorecard printing e.g. DC
//    DPMO 3123 as "Fantastic" and DSB 1038 as "Poor" only reconciles with the
//    printed Overall if the conversion is continuous. (A pure tier-anchor
//    average is mathematically impossible; it would require Poor to be worth
//    more points than Fair.)
//
//  Layer 2 (metric sub-scores → Overall):  A LINEAR weighted average of the
//    metric sub-scores, using the effective weights below, then mapped to the
//    Overall Standing band (Poor / Fair / Great / Fantastic / Fantastic Plus).
//
//  Gates:  (1) Overall cannot exceed the Safety & Compliance sub-score.
//          (2) "Capped for Quality" — a Fantastic Overall requires Fantastic in
//              Delivery Quality (and Pickup Quality where active).
//
// Thresholds here are BEST-KNOWN ESTIMATES (labeled "estimated" in the UI).
// Because they are approximate, the planner reads the printed Overall directly
// from the PDF and applies a calibration offset so the displayed baseline
// exactly matches the real number; what-if deltas are layered on top.

// ── Effective metric weights ────────────────────────────────────────────────
// These are post-redistribution: FICO and Tenured Workforce currently carry 0%,
// and Pickup is "Coming Soon", so their nominal weight is spread across the
// active metrics. Values sum to ~100%.
export const METRICS = [
  // key,        label,                     group,      weight, dir,   unit
  { key: "speeding",   label: "Speeding Event Rate",       group: "Safety",  weight: 11.7, dir: "down", unit: "/100 trips" },
  { key: "seatbelt",   label: "Seatbelt-Off Rate",         group: "Safety",  weight: 11.7, dir: "down", unit: "/100 trips" },
  { key: "signSignal", label: "Sign / Signal Violations",  group: "Safety",  weight: 11.7, dir: "down", unit: "/100 trips" },
  { key: "distractions", label: "Distractions Rate",       group: "Safety",  weight: 7.5,  dir: "down", unit: "/100 trips" },
  { key: "following",  label: "Following Distance Rate",   group: "Safety",  weight: 5.0,  dir: "down", unit: "/100 trips" },
  { key: "ced",        label: "Customer Escalation DPMO",  group: "Quality", weight: 12.7, dir: "down", unit: "DPMO" },
  { key: "dc",         label: "Delivery Completion DPMO",  group: "Quality", weight: 12.7, dir: "down", unit: "DPMO" },
  { key: "dsb",        label: "Delivery Success Behaviors", group: "Quality", weight: 12.7, dir: "down", unit: "DPMO" },
  { key: "cdf",        label: "Customer Delivery Feedback DPMO", group: "Quality", weight: 6.3,  dir: "down", unit: "DPMO" },
  { key: "fleet",      label: "Fleet Execution",           group: "Ops",     weight: 5.0,  dir: "down", unit: "score" },
  { key: "pod",        label: "Photo-on-Delivery",         group: "Quality", weight: 3.1,  dir: "up",   unit: "%" },
];

// Sum of weights (≈100). Used to normalize the weighted average.
export const WEIGHT_SUM = METRICS.reduce((s, m) => s + m.weight, 0);

// ── Estimated tier thresholds (raw-value anchors) ───────────────────────────
// For dir:"down" metrics, lower is better; thresholds are the UPPER edge of
// each tier. For dir:"up", higher is better; thresholds are the LOWER edge.
// Order: [fantasticPlus?, fantastic, great, fair]  (Poor = worse than fair edge)
// We anchor 5 sub-score points to these: fantasticPlus→100, fantastic→90,
// great→70, fair→50, poor floor→further extrapolation.
export const THRESHOLDS = {
  // down metrics: {fantastic, great, fair}  (Poor is beyond fair)
  speeding:    { dir: "down", fantastic: 5,    great: 10,   fair: 20 },
  seatbelt:    { dir: "down", fantastic: 5,    great: 10,   fair: 20 },
  signSignal:  { dir: "down", fantastic: 5,    great: 10,   fair: 20 },
  distractions:{ dir: "down", fantastic: 5,    great: 10,   fair: 20 },
  following:   { dir: "down", fantastic: 5,    great: 10,   fair: 20 },
  ced:         { dir: "down", fantastic: 2000, great: 4000, fair: 6000 },
  dc:          { dir: "down", fantastic: 3500, great: 5000, fair: 7500 },
  // DSB 258 and Fleet 6.66 both print as "Great" (Week 40 2026), so the
  // Fantastic DSB edge sits below 258 and the Great Fleet edge above 6.66.
  dsb:         { dir: "down", fantastic: 250,  great: 550,  fair: 900 },
  cdf:         { dir: "down", fantastic: 750,  great: 1300, fair: 1900 },
  fleet:       { dir: "down", fantastic: 3,    great: 7,    fair: 10 },
  pod:         { dir: "up",   fantastic: 98,   great: 96,   fair: 93 },
};

// Sub-score anchor points (the 0–100 value a raw threshold maps to). A perfect
// raw value (0 events / 0 DPMO / 100% POD) scores 100; the curve then falls
// steeply, so a metric that only just makes Fantastic scores 64.
// Fitted to BRGL DTG5 Week 40 2026: those raw numbers reproduce the printed
// 84.8 Overall to within 0.1 with no calibration. The earlier 90/70/50 anchors
// over-scored that week at 94.7.
export const ANCHOR = { fantastic: 64, great: 44, fair: 24, poorFloor: 0 };

// Representative sub-score for "a metric sitting in this tier" — the middle of
// each band. Used by the calculator presets.
export const TIER_SUB = {
  fair: (ANCHOR.fair + ANCHOR.great) / 2,
  great: (ANCHOR.great + ANCHOR.fantastic) / 2,
  fantastic: (ANCHOR.fantastic + 100) / 2,
  max: 100,
};

// Overall Standing bands (on the 0–100 weighted-average scale).
export const OVERALL_BANDS = [
  [95, "Fantastic Plus", "fantasticplus"],
  [80, "Fantastic", "fantastic"],
  [60, "Great", "great"],
  [40, "Fair", "fair"],
  [-Infinity, "Poor", "poor"],
];

export function overallTier(score) {
  if (score === null || score === undefined) return { label: null, cls: "neutral" };
  const b = OVERALL_BANDS.find(([min]) => score >= min);
  return { label: b[1], cls: b[2] };
}

// Tier label for a single metric sub-score, using the same anchors as the
// raw→sub curve so a raw value and its sub-score always agree on the tier.
// (Amazon prints metrics up to "Fantastic"; Fantastic Plus is Overall-only.)
export function subScoreTier(sub) {
  if (sub === null || sub === undefined) return { label: null, cls: "neutral" };
  if (sub >= ANCHOR.fantastic) return { label: "Fantastic", cls: "fantastic" };
  if (sub >= ANCHOR.great) return { label: "Great", cls: "great" };
  if (sub >= ANCHOR.fair) return { label: "Fair", cls: "fair" };
  return { label: "Poor", cls: "poor" };
}

function lerp(a0, a1, s0, s1, x) {
  if (a1 === a0) return s0;
  const t = (x - a0) / (a1 - a0);
  return s0 + t * (s1 - s0);
}

// Raw metric value → 0–100 sub-score, piecewise-linear through the anchors.
export function rawToSubScore(key, raw) {
  if (raw === null || raw === undefined || raw === "" || isNaN(Number(raw))) return null;
  const x = Number(raw);
  const t = THRESHOLDS[key];
  if (!t) return null;

  if (t.dir === "down") {
    // Better = smaller. 0 (or below fantastic) → up to 100.
    const { fantastic, great, fair } = t;
    if (x <= fantastic) {
      // Between a perfect 0 and the fantastic edge → 100..90
      return clamp(lerp(0, fantastic, 100, ANCHOR.fantastic, x), 0, 100);
    }
    if (x <= great) return clamp(lerp(fantastic, great, ANCHOR.fantastic, ANCHOR.great, x), 0, 100);
    if (x <= fair) return clamp(lerp(great, fair, ANCHOR.great, ANCHOR.fair, x), 0, 100);
    // Poor: extrapolate from fair edge downward toward 0 over one more band-width.
    const bandW = fair - great || 1;
    return clamp(lerp(fair, fair + bandW * 2, ANCHOR.fair, ANCHOR.poorFloor, x), 0, 100);
  } else {
    // Better = larger (POD).
    const { fantastic, great, fair } = t;
    if (x >= fantastic) return clamp(lerp(fantastic, 100, ANCHOR.fantastic, 100, x), 0, 100);
    if (x >= great) return clamp(lerp(great, fantastic, ANCHOR.great, ANCHOR.fantastic, x), 0, 100);
    if (x >= fair) return clamp(lerp(fair, great, ANCHOR.fair, ANCHOR.great, x), 0, 100);
    const bandW = great - fair || 1;
    return clamp(lerp(fair - bandW * 2, fair, ANCHOR.poorFloor, ANCHOR.fair, x), 0, 100);
  }
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

// Weighted-average overall from a map of {key: rawValue}. Missing metrics are
// dropped and the remaining weights renormalized.
export function computeOverall(rawValues) {
  let wsum = 0;
  let acc = 0;
  const parts = [];
  for (const m of METRICS) {
    const sub = rawToSubScore(m.key, rawValues[m.key]);
    if (sub === null) continue;
    wsum += m.weight;
    acc += sub * m.weight;
    parts.push({ key: m.key, label: m.label, group: m.group, weight: m.weight, raw: rawValues[m.key], sub: round1(sub) });
  }
  const overall = wsum > 0 ? acc / wsum : null;
  // Safety gate: overall cannot exceed the average safety sub-score.
  const safetyParts = parts.filter((p) => p.group === "Safety");
  let gatedOverall = overall;
  if (overall !== null && safetyParts.length) {
    const sw = safetyParts.reduce((s, p) => s + p.weight, 0);
    const safetyAvg = safetyParts.reduce((s, p) => s + p.sub * p.weight, 0) / sw;
    if (safetyAvg < overall) gatedOverall = safetyAvg;
  }
  return {
    overall: overall === null ? null : round1(overall),
    gatedOverall: gatedOverall === null ? null : round1(gatedOverall),
    parts: parts.sort((a, b) => b.weight - a.weight),
    weightCovered: round1(wsum),
  };
}

// Aggregate an Overall directly from per-metric SUB-SCORES (0–100), mirroring
// computeOverall's weighting + safety gate. Used by the interactive weight
// calculator, where the user drags each metric's performance on the 0–100 scale
// instead of entering raw numbers. Missing metrics drop out and weights
// renormalize across the rest.
export function overallFromSubScores(subs) {
  let wsum = 0;
  let acc = 0;
  const parts = [];
  for (const m of METRICS) {
    const sub = subs[m.key];
    if (sub === null || sub === undefined || isNaN(Number(sub))) continue;
    const s = clamp(Number(sub), 0, 100);
    wsum += m.weight;
    acc += s * m.weight;
    parts.push({ key: m.key, label: m.label, group: m.group, weight: m.weight, sub: round1(s) });
  }
  const overall = wsum > 0 ? acc / wsum : null;
  const safetyParts = parts.filter((p) => p.group === "Safety");
  let gatedOverall = overall;
  let safetyGated = false;
  if (overall !== null && safetyParts.length) {
    const sw = safetyParts.reduce((s, p) => s + p.weight, 0);
    const safetyAvg = safetyParts.reduce((s, p) => s + p.sub * p.weight, 0) / sw;
    if (safetyAvg < overall) { gatedOverall = safetyAvg; safetyGated = true; }
  }
  return {
    overall: overall === null ? null : round1(overall),
    gatedOverall: gatedOverall === null ? null : round1(gatedOverall),
    parts: parts.sort((a, b) => b.weight - a.weight),
    weightCovered: round1(wsum),
    safetyGated,
  };
}

// How many Overall points a +1 sub-score point on this metric is worth, given
// the covered weight. This is the metric's "lever strength" — pure weight math,
// independent of current performance.
export function leverSensitivity(key, weightCovered = WEIGHT_SUM) {
  const m = METRICS.find((x) => x.key === key);
  if (!m || !weightCovered) return 0;
  return round1((m.weight / weightCovered) * 100) / 100; // per +1 sub point
}

// Point contribution of each metric to the (renormalized) weighted average.
// Ranks metrics as levers: how many overall points you'd gain by moving this
// metric from its current sub-score to a target sub-score.
export function rankLevers(rawValues, targetSub = 90) {
  const { parts, weightCovered } = computeOverall(rawValues);
  if (!weightCovered) return [];
  return parts
    .map((p) => {
      const headroom = Math.max(0, targetSub - p.sub);
      const overallGain = (headroom * p.weight) / weightCovered;
      return { ...p, headroom: round1(headroom), overallGain: round1(overallGain) };
    })
    .sort((a, b) => b.overallGain - a.overallGain);
}

// Calibration: given the PDF's printed overall and the model's computed overall,
// return the offset to add so displayed baseline == printed.
export function calibrationOffset(printedOverall, modelOverall) {
  if (printedOverall === null || modelOverall === null) return 0;
  return round1(printedOverall - modelOverall);
}

// Project a new overall when one or more raw values change, keeping the
// calibration offset fixed so the baseline still matches the printed number.
export function projectOverall(baseRaw, changes, offset = 0) {
  const merged = { ...baseRaw, ...changes };
  const { overall, gatedOverall } = computeOverall(merged);
  const adj = gatedOverall === null ? null : round1(gatedOverall + offset);
  return { raw: merged, overall, gatedOverall, calibrated: adj };
}

function round1(x) {
  return Math.round(x * 10) / 10;
}

// ── PDF text parser ─────────────────────────────────────────────────────────
// Takes the text extracted from a scorecard PDF (via pdf.js) or a CSV and pulls
// out the printed Overall + each metric's raw value and tier label.
//
// The summary page prints every metric as  "<Label> <value> [unit] | <Tier>",
// e.g. "Seatbelt-Off Rate 0.0 events per 100 trips | Fantastic". We anchor on
// that "value | Tier" shape so (a) unit text like "per 100 trips" is never
// mistaken for the value, and (b) the same label appearing in "Key Focus Areas"
// ("1. Delivery Success Behaviors"), the abbreviations key or the glossary is
// ignored. A looser label→first-number fallback still covers CSVs and odd
// layouts. Returns {overall, overallTier, values{}, tiers{}, matched:[], missed:[]}.
const PARSE_RULES = [
  { key: "overall", labels: ["overall standing", "overall score"], kind: "overall" },
  { key: "speeding", labels: ["speeding event rate", "speeding"], kind: "num" },
  { key: "seatbelt", labels: ["seatbelt-off rate", "seatbelt off rate", "seat belt off rate", "seatbelt", "seat belt"], kind: "num" },
  { key: "signSignal", labels: ["sign/signal violations rate", "sign/signal", "sign and signal", "sign signal"], kind: "num" },
  { key: "distractions", labels: ["distractions rate", "distraction"], kind: "num" },
  { key: "following", labels: ["following distance rate", "following distance"], kind: "num" },
  { key: "ced", labels: ["customer escalation defect dpmo", "customer escalation", "escalation defect", "ced"], kind: "num" },
  { key: "dc", labels: ["delivery completion dpmo", "delivery completion", "dcr dpmo", "dc dpmo"], kind: "num" },
  { key: "dsb", labels: ["delivery success behaviors", "delivery success behavior", "dsb"], kind: "num" },
  { key: "cdf", labels: ["customer delivery feedback dpmo", "customer delivery feedback", "contact compliance", "cdf dpmo", "cdf"], kind: "num" },
  { key: "fleet", labels: ["fleet execution", "fleet"], kind: "num" },
  { key: "pod", labels: ["photo-on-delivery acceptance rate", "photo-on-delivery", "photo on delivery", "pod acceptance", "pod"], kind: "num" },
];

const TIER_WORDS = ["fantastic plus", "fantastic", "great", "fair", "poor"];
const NUM_RE = "(-?\\d[\\d,]*(?:\\.\\d+)?)";
const TIER_RE = "(fantastic plus|fantastic|great|fair|poor)";
// Value + optional unit + "| Tier", allowing a short gap (e.g. "(DC DPMO):").
const VALUE_TIER_RE = new RegExp(
  "^[\\s:()a-z]{0,24}?" + NUM_RE + "\\s*(?:%|events?\\s+per\\s+100\\s+trips|per\\s+100\\s+trips|dpmo)?\\s*\\|\\s*" + TIER_RE
);

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Lower-case and undo pdf.js spacing artifacts ("Seatbelt- Off", "Sign/ Signal",
// "Photo- On- Delivery", runs of spaces) so labels match reliably.
function normalizeText(rawText) {
  return (rawText || "")
    .replace(/\r/g, "\n")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\s*-\s+(?=[a-z])/g, "-")
    .replace(/\s*\/\s*/g, "/");
}

function toNum(s) {
  const n = Number(String(s).replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

// Strict pass: a label immediately followed by "value [unit] | Tier".
function findValueTier(flat, labels) {
  for (const lab of labels) {
    const re = new RegExp("(^|[^a-z])" + escapeRe(lab) + "(?![a-z])", "g");
    let m;
    while ((m = re.exec(flat))) {
      const after = flat.slice(m.index + m[0].length, m.index + m[0].length + 80);
      const v = after.match(VALUE_TIER_RE);
      if (v) return { num: toNum(v[1]), tier: v[2] };
    }
  }
  return null;
}

// Loose pass (CSV / unusual layouts): first number AFTER the label on its line,
// skipping unit phrases like "per 100 trips" and list markers like "1.".
function findLoose(lines, labels) {
  for (const ln of lines) {
    for (const lab of labels) {
      const i = ln.indexOf(lab);
      if (i < 0) continue;
      const rest = ln
        .slice(i + lab.length)
        .replace(/(events?\s+)?per\s+100\s+(trips|opportunities)/g, " ");
      const nm = rest.match(new RegExp(NUM_RE));
      if (!nm) continue;
      // Ignore "Key Focus Areas" ranks ("delivery success behaviors 1.").
      if (/^\s*\d\.\s*$/.test(rest)) continue;
      const tier = TIER_WORDS.find((w) => rest.includes(w)) || null;
      return { num: toNum(nm[1]), tier };
    }
  }
  return null;
}

export function parseScorecardText(rawText) {
  const norm = normalizeText(rawText);
  const lines = norm.split("\n").map((l) => l.trim()).filter(Boolean);
  const flat = lines.join(" ");

  const values = {};
  const tiers = {};
  const matched = [];
  const missed = [];
  let overall = null;
  let overallTierLabel = null;

  for (const rule of PARSE_RULES) {
    const hit = findValueTier(flat, rule.labels) || findLoose(lines, rule.labels);
    if (!hit || hit.num === null) {
      if (rule.key !== "overall") missed.push(rule.key);
      continue;
    }
    if (rule.kind === "overall") {
      overall = hit.num;
      overallTierLabel = hit.tier ? titleCase(hit.tier) : null;
      matched.push("overall");
    } else {
      values[rule.key] = hit.num;
      matched.push(rule.key);
      if (hit.tier) tiers[rule.key] = titleCase(hit.tier);
    }
  }

  return { overall, overallTier: overallTierLabel, values, tiers, matched, missed };
}

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Supplemental CSV slots the planner accepts (mirrors what Breez pulls daily).
export const SUPPLEMENTAL_SLOTS = [
  { key: "quality", label: "Quality / DSB Overview", hint: "Per-driver DSB, DCR, CED, POD" },
  { key: "rts", label: "Daily Return-to-Station", hint: "Controllable RTS by driver/day" },
  { key: "concessions", label: "Concessions", hint: "Concession events & reasons" },
  { key: "feedback", label: "Negative Feedback", hint: "Customer complaints by driver" },
  { key: "drivers", label: "Driver-Level Data", hint: "Any per-DA export" },
];
