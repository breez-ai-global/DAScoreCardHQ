"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Logo from "../../components/Logo";
import {
  METRICS,
  THRESHOLDS,
  rawToSubScore,
  subScoreTier,
  computeOverall,
  rankLevers,
  calibrationOffset,
  parseScorecardText,
  ANCHOR,
  overallTier,
  SUPPLEMENTAL_SLOTS,
} from "../../lib/amazonModel";

const PDFJS_SRC =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

// ── tiny client-side CSV parser (BOM / CRLF / quoted fields) ────────────────
function parseCSV(text) {
  const s = text.replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else q = false;
      } else field += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && s[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  const body = rows.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    return o;
  });
  return { headers, rows: body };
}

function fmt(n, d = 1) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: d });
}

const TIER_CLS = {
  "Fantastic Plus": "tier-fantastic",
  Fantastic: "tier-fantastic",
  Great: "tier-great",
  Fair: "tier-fair",
  Poor: "tier-poor",
};

// Raw values the what-if sliders start from before any scorecard is loaded:
// a perfect week (0 events / 0 DPMO / 100% POD).
const PERFECT_RAW = Object.fromEntries(
  METRICS.map((m) => [m.key, THRESHOLDS[m.key].dir === "up" ? 100 : 0])
);

// Slider range + step in the metric's own raw units (events/100 trips, DPMO,
// %, score). Always wide enough to include the current value.
function rawRange(key, cur) {
  const th = THRESHOLDS[key];
  if (th.dir === "up") {
    const lo = Math.min(th.fair - (th.great - th.fair) * 2, cur ?? Infinity);
    return { min: Math.floor(lo), max: 100, step: 0.01 };
  }
  const hi = Math.max(th.fair + (th.fair - th.great) * 2, (cur ?? 0) * 1.25);
  return { min: 0, max: hi, step: hi <= 50 ? 0.1 : 1 };
}

export default function PlannerApp() {
  const [pdfReady, setPdfReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [values, setValues] = useState({}); // {key: raw}
  const [printedOverall, setPrintedOverall] = useState(null);
  const [printedTier, setPrintedTier] = useState(null);
  const [parseInfo, setParseInfo] = useState(null);
  const [whatIf, setWhatIf] = useState({}); // key -> raw slider override
  const [supp, setSupp] = useState({}); // slotKey -> {fileName, headers, rows}
  const [target, setTarget] = useState(100);
  const [showLogic, setShowLogic] = useState(true);
  // Bumped on Clear so uncontrolled file inputs remount and the same file can
  // be re-selected.
  const [resetKey, setResetKey] = useState(0);

  // Load pdf.js UMD build
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.pdfjsLib) { setPdfReady(true); return; }
    const sc = document.createElement("script");
    sc.src = PDFJS_SRC;
    sc.onload = () => {
      try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; } catch {}
      setPdfReady(true);
    };
    sc.onerror = () => setPdfReady(false);
    document.body.appendChild(sc);
  }, []);

  // Extract a text blob from a PDF, reconstructing lines by y-position so a
  // label and its value stay on the same line.
  async function pdfToText(file) {
    if (!window.pdfjsLib) throw new Error("PDF reader still loading — try again in a moment");
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    let text = "";
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const byLine = {};
      for (const it of content.items) {
        const y = Math.round(it.transform[5]);
        (byLine[y] = byLine[y] || []).push(it.str);
      }
      const ys = Object.keys(byLine).map(Number).sort((a, b) => b - a);
      for (const y of ys) text += byLine[y].join(" ") + "\n";
      text += "\n";
    }
    return text;
  }

  // Turn a CSV into a label+value text blob the scorecard parser understands.
  // Handles both orientations: "wide" (header row of labels + a data row of
  // values) and "long" (each row is label,value[,tier]).
  function csvToText(raw) {
    const { headers, rows } = parseCSV(raw);
    const lines = [];
    if (headers.length && rows.length) {
      const first = rows[0];
      for (const h of headers) {
        const v = first[h];
        if (v !== undefined && v !== "") lines.push(`${h} ${v}`);
      }
    }
    for (const r of rows) lines.push(headers.map((h) => r[h] ?? "").join(" "));
    // Include the raw text too as a final fallback for odd layouts.
    return lines.join("\n") + "\n" + raw;
  }

  async function handleFile(file) {
    if (!file) return;
    setBusy(true);
    setFileName(file.name);
    try {
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const text = isPdf ? await pdfToText(file) : csvToText(await file.text());
      const parsed = parseScorecardText(text);
      const newValues = parsed.values || {};
      setValues(newValues);                        // replace, not merge
      setPrintedOverall(parsed.overall);
      setPrintedTier(parsed.overallTier);
      setParseInfo(parsed);
      setWhatIf({});
    } catch (e) {
      setParseInfo({ error: String(e && e.message ? e.message : e), matched: [], missed: [] });
    } finally {
      setBusy(false);
    }
  }

  async function handleSupp(slotKey, file) {
    if (!file) return;
    const text = await file.text();
    const { headers, rows } = parseCSV(text);
    setSupp((s) => ({ ...s, [slotKey]: { fileName: file.name, headers, rows } }));
  }

  function setVal(key, raw) {
    const num = raw === "" ? undefined : Number(raw);
    setValues((v) => ({ ...v, [key]: num }));
    setWhatIf((w) => { const n = { ...w }; delete n[key]; return n; });
  }

  // Reset the whole tool back to its initial state.
  function handleClear() {
    setValues({});
    setWhatIf({});
    setSupp({});
    setPrintedOverall(null);
    setPrintedTier(null);
    setParseInfo(null);
    setFileName("");
    setTarget(100);
    setResetKey((k) => k + 1);
  }

  // ── computed model ──
  const model = useMemo(() => computeOverall(values), [values]);
  const offset = useMemo(
    () => calibrationOffset(printedOverall, model.overall),
    [printedOverall, model.overall]
  );
  const levers = useMemo(() => rankLevers(values, target), [values, target]);

  // What-if: the sliders hold raw values in the same units as the table. They
  // start on the loaded scorecard (or on a perfect week if nothing is
  // loaded) and run through exactly the same computeOverall + calibration as
  // the breakdown, so untouched sliders always equal the printed Overall.
  const simBase = useMemo(
    () => (Object.keys(values).length ? values : PERFECT_RAW),
    [values]
  );
  const simOffset = printedOverall !== null ? offset : 0;
  const simCalibrated = (raw) => {
    const g = computeOverall(raw).gatedOverall;
    return g === null ? null : Math.max(0, Math.min(100, Math.round((g + simOffset) * 10) / 10));
  };
  const simRaw = useMemo(() => ({ ...simBase, ...whatIf }), [simBase, whatIf]);
  const simNow = useMemo(() => simCalibrated(simBase), [simBase, simOffset]); // eslint-disable-line
  const simProj = useMemo(() => simCalibrated(simRaw), [simRaw, simOffset]); // eslint-disable-line
  const simTier = overallTier(simProj);
  const simGated = useMemo(() => {
    const r = computeOverall(simRaw);
    return r.gatedOverall !== null && r.gatedOverall < r.overall;
  }, [simRaw]);
  const setAll = (target) =>
    setWhatIf(Object.fromEntries(Object.keys(simBase).map((k) => [k, target[k]])));

  const weightsByWeight = useMemo(
    () => [...METRICS].sort((a, b) => b.weight - a.weight),
    []
  );

  const hasData = model.parts.length > 0;
  const baselineDisplay =
    printedOverall !== null
      ? printedOverall
      : model.gatedOverall;
  const baseTier =
    printedTier || overallTier(baselineDisplay).label;

  return (
    <div className="pl-wrap">
      <header className="pl-head">
        <div className="pl-brand">
          <Logo size={40} />
          <div>
            <div className="pl-title">Scorecard Planner</div>
            <div className="pl-sub">
              Upload any Amazon DSP weekly scorecard — see exactly what drives the Overall.
            </div>
          </div>
        </div>
        <div className="pl-head-right">
          <span className="pl-priv">Processed in your browser · nothing is uploaded or stored</span>
          <button className="pl-clear" type="button" onClick={handleClear}>
            Clear all
          </button>
        </div>
      </header>

      {/* HOW IT WORKS — scoring logic explainer */}
      <section className="pl-card">
        <div className="pl-explain-head">
          <div className="pl-step" style={{ marginBottom: 0 }}>How the Overall is calculated</div>
          <button className="pl-toggle" onClick={() => setShowLogic((s) => !s)}>
            {showLogic ? "Hide" : "Show"}
          </button>
        </div>
        {showLogic && (
          <div className="pl-explain">
            <p className="pl-explain-lead">
              Your weekly scorecard isn&apos;t a simple average of tier labels. Amazon computes it in
              two layers, then applies two gates. Here&apos;s the whole thing.
            </p>

            <div className="pl-layers">
              <div className="pl-layer">
                <div className="pl-layer-num">Layer 1</div>
                <div className="pl-layer-title">Each raw number becomes a 0–100 sub-score</div>
                <p>
                  Every metric&apos;s raw value (DPMO, event rate, POD %) is mapped onto a 0–100
                  sub-score along a <b>continuous sloped line</b> anchored at the tier edges —
                  a perfect 0 scores 100, the Fantastic edge ≈ {ANCHOR.fantastic}, Great ≈ {ANCHOR.great}, Fair ≈ {ANCHOR.fair}. It is <b>not</b> a flat step per tier, so
                  shaving a DPMO even without changing tier still earns points.
                </p>
              </div>
              <div className="pl-layer">
                <div className="pl-layer-num">Layer 2</div>
                <div className="pl-layer-title">Sub-scores are blended by weight</div>
                <p>
                  The sub-scores are combined into one number using a <b>weighted average</b> — the
                  weights below. That number maps to your Overall Standing band: Poor / Fair / Great /
                  Fantastic / Fantastic&nbsp;Plus.
                </p>
              </div>
              <div className="pl-layer">
                <div className="pl-layer-num">Gates</div>
                <div className="pl-layer-title">Two ceilings that can pull you down</div>
                <p>
                  <b>Safety ceiling:</b> your Overall can never exceed your Safety &amp; Compliance
                  score — weak safety caps everything. <b>Capped for Quality:</b> a Fantastic Overall
                  requires Fantastic Delivery Quality.
                </p>
              </div>
            </div>

            <div className="pl-weighttable">
              <div className="pl-wt-title">Effective metric weights (what actually moves the needle)</div>
              <div className="pl-wt-grid">
                {weightsByWeight.map((m) => (
                  <div className="pl-wt-row" key={m.key}>
                    <div className="pl-wt-bar">
                      <div
                        className="pl-wt-barfill"
                        style={{ width: `${(m.weight / weightsByWeight[0].weight) * 100}%` }}
                      />
                    </div>
                    <div className="pl-wt-lab">{m.label}</div>
                    <div className="pl-wt-grp">{m.group}</div>
                    <div className="pl-wt-pct">{fmt(m.weight)}%</div>
                  </div>
                ))}
              </div>
              <div className="pl-legend" style={{ marginTop: 10 }}>
                Weights are effective values after Amazon redistributes inactive metrics (FICO,
                Tenured Workforce) and the &quot;Coming Soon&quot; Pickup group across the active
                metrics. They sum to ~100%. Tier thresholds are best-known estimates.
              </div>
            </div>
          </div>
        )}
      </section>

      {/* STEP 1 — upload / enter */}
      <section className="pl-card">
        <div className="pl-step">1 · Load your scorecard</div>
        <div className="pl-upgrid">
          <label className={`pl-drop${busy ? " busy" : ""}`}>
            <input
              key={`pdf-${resetKey}`}
              type="file"
              accept="application/pdf,.pdf,.csv,.tsv,text/csv"
              disabled={busy}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <span className="pl-drop-big">
              {busy ? "Reading…" : "Drop / choose a scorecard PDF or CSV"}
            </span>
            <span className="pl-drop-small">
              {pdfReady ? "Auto-reads the printed numbers (PDF or CSV)" : "Loading PDF reader… (CSV works now)"}
            </span>
            {fileName && <span className="pl-file">{fileName}</span>}
          </label>
          <div className="pl-note">
            No file? Type the raw numbers into the table below — everything still works.
            {parseInfo && !parseInfo.error && (
              <div className="pl-parseinfo">
                Read {parseInfo.matched.length} field{parseInfo.matched.length === 1 ? "" : "s"}
                {parseInfo.missed.length ? ` · ${parseInfo.missed.length} not found (enter manually)` : " ✓"}
              </div>
            )}
            {parseInfo && parseInfo.error && (
              <div className="pl-parseerr">Couldn&apos;t read that PDF ({parseInfo.error}). Enter numbers manually.</div>
            )}
          </div>
        </div>
      </section>

      {/* STEP 2 — breakdown */}
      <section className="pl-card">
        <div className="pl-step">2 · What drove the Overall</div>

        <div className="pl-overallrow">
          <div className="pl-bigscore">
            <div className="pl-bs-num">{baselineDisplay === null ? "—" : fmt(baselineDisplay)}</div>
            <div className={`pl-bs-tier ${TIER_CLS[baseTier] || "tier-nodata"}`}>
              {baseTier || "No data yet"}
            </div>
            <div className="pl-bs-lab">
              {printedOverall !== null ? "Printed Overall Standing" : "Modeled Overall"}
            </div>
          </div>
          <div className="pl-calib">
            {printedOverall !== null && hasData ? (
              <>
                <div>
                  Model reconstructs this at <b>{fmt(model.gatedOverall)}</b>
                  {Math.abs(offset) >= 0.1 && (
                    <> (calibrated by {offset > 0 ? "+" : ""}{fmt(offset)} to match the printed number)</>
                  )}.
                </div>
                <div className="pl-calib-hint">
                  Thresholds are best-known estimates, so the breakdown is anchored to your real Overall.
                </div>
              </>
            ) : (
              <div className="pl-calib-hint">
                Load a PDF or enter numbers to see the metric-by-metric breakdown.
              </div>
            )}
          </div>
        </div>

        <div className="pl-tablewrap">
          <table className="pl-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Group</th>
                <th className="num">Raw</th>
                <th className="num">Sub-score</th>
                <th>Tier</th>
                <th className="num">Weight</th>
                <th className="num">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => {
                const raw = values[m.key];
                const sub = rawToSubScore(m.key, raw);
                // Prefer the tier Amazon printed for this exact value; the
                // modeled tier is only a fallback (thresholds are estimates).
                const printed =
                  parseInfo?.tiers?.[m.key] && parseInfo.values?.[m.key] === raw
                    ? parseInfo.tiers[m.key]
                    : null;
                const t = printed ? { label: printed } : subScoreTier(sub);
                const contrib =
                  sub !== null && model.weightCovered
                    ? (sub * m.weight) / model.weightCovered
                    : null;
                return (
                  <tr key={m.key}>
                    <td>
                      <div className="pl-mname">{m.label}</div>
                      <div className="pl-munit">
                        {THRESHOLDS[m.key]?.dir === "up" ? "higher better" : "lower better"} · {m.unit}
                      </div>
                    </td>
                    <td className="pl-grp">{m.group}</td>
                    <td className="num">
                      <input
                        className="pl-raw"
                        inputMode="decimal"
                        value={raw ?? ""}
                        placeholder="—"
                        onChange={(e) => setVal(m.key, e.target.value)}
                      />
                    </td>
                    <td className="num">{sub === null ? "—" : fmt(sub)}</td>
                    <td className={TIER_CLS[t.label] || "tier-nodata"}>{t.label || "—"}</td>
                    <td className="num pl-wt">{fmt(m.weight)}%</td>
                    <td className="num">{contrib === null ? "—" : fmt(contrib)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="pl-legend">
          Contribution = the points this metric adds to your Overall (sub-score × weight ÷ covered weight).
          Weights are effective values after Amazon redistributes inactive metrics (FICO, Tenured Workforce, Pickup).
        </div>
      </section>

      {/* STEP 3 — levers */}
      {hasData && (
        <section className="pl-card">
          <div className="pl-step">3 · Biggest levers</div>
          <div className="pl-leverhead">
            If each metric were lifted to a sub-score of
            <select value={target} onChange={(e) => setTarget(Number(e.target.value))}>
              <option value={ANCHOR.great}>{ANCHOR.great} (Great)</option>
              <option value={ANCHOR.fantastic}>{ANCHOR.fantastic} (Fantastic)</option>
              <option value={100}>100 (perfect)</option>
            </select>
            , here&apos;s how many Overall points each move is worth — highest first.
          </div>
          <div className="pl-bars">
            {levers.filter((l) => l.overallGain > 0).length === 0 && (
              <div className="pl-calib-hint">Every covered metric is already at or above the target. 🎉</div>
            )}
            {levers.filter((l) => l.overallGain > 0).map((l) => {
              const max = levers[0]?.overallGain || 1;
              return (
                <div className="pl-barrow" key={l.key}>
                  <div className="pl-barlab">{l.label}</div>
                  <div className="pl-bartrack">
                    <div className="pl-barfill" style={{ width: `${Math.max(4, (l.overallGain / max) * 100)}%` }} />
                  </div>
                  <div className="pl-barval">+{fmt(l.overallGain)}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* STEP 4 — what-if, in raw scorecard units */}
      <section className="pl-card">
        <div className="pl-step">4 · What-if planner</div>
        <div className="pl-calc-intro">
          {hasData
            ? "Sliders start on your real scorecard numbers. Drag any metric to see what the Overall would have been."
            : "Load a scorecard above and these sliders start on your real numbers. Until then they start on a perfect week."}
        </div>
        <div className="pl-calc">
          <div className="pl-calc-controls">
            {weightsByWeight
              .filter((m) => simBase[m.key] !== undefined)
              .map((m) => {
                const actual = simBase[m.key];
                const cur = simRaw[m.key];
                const th = THRESHOLDS[m.key];
                const rng = rawRange(m.key, actual);
                const printed =
                  parseInfo?.tiers?.[m.key] && parseInfo.values?.[m.key] === cur
                    ? parseInfo.tiers[m.key]
                    : null;
                const t = printed ? { label: printed } : subScoreTier(rawToSubScore(m.key, cur));
                const moved = whatIf[m.key] !== undefined && whatIf[m.key] !== actual;
                return (
                  <div className="pl-calc-row" key={m.key}>
                    <div className="pl-calc-lab">
                      <span className="pl-calc-name">{m.label}</span>
                      <span className="pl-calc-wt">{fmt(m.weight)}% weight</span>
                    </div>
                    <input
                      type="range"
                      min={rng.min}
                      max={rng.max}
                      step={rng.step}
                      value={cur}
                      onChange={(e) =>
                        setWhatIf((w) => ({ ...w, [m.key]: Number(e.target.value) }))
                      }
                    />
                    <div className="pl-calc-meta">
                      <span className={`pl-calc-tier ${TIER_CLS[t.label] || "tier-nodata"}`}>
                        {fmt(cur, 2)} {m.unit} · {t.label || "—"}
                        {moved && <span className="pl-calc-sens"> (actual {fmt(actual, 2)})</span>}
                      </span>
                      <span className="pl-calc-sens">
                        Fantastic {th.dir === "up" ? "≥" : "≤"} {fmt(th.fantastic, 2)} (est.)
                      </span>
                    </div>
                  </div>
                );
              })}
            <div className="pl-calc-presets">
              <span>Set all to:</span>
              <button onClick={() => setWhatIf({})}>{hasData ? "My scorecard" : "Reset"}</button>
              <button onClick={() => setAll(PERFECT_RAW)}>Perfect</button>
            </div>
          </div>
          <div className="pl-calc-out">
            <div className="pl-wi-outlab">{hasData ? "Projected Overall" : "Modeled Overall"}</div>
            <div className="pl-wi-outnum">{simProj === null ? "—" : fmt(simProj)}</div>
            <div className={`pl-wi-outtier ${TIER_CLS[simTier.label] || "tier-nodata"}`}>
              {simTier.label || "—"}
            </div>
            {simNow !== null && simProj !== null && (
              <div className="pl-wi-delta">
                {simProj - simNow >= 0 ? "▲ +" : "▼ "}
                {fmt(simProj - simNow)} vs {hasData ? "your scorecard" : "start"}
              </div>
            )}
            {simGated && (
              <div className="pl-calc-gate">⚠ Safety ceiling is capping this Overall.</div>
            )}
          </div>
        </div>
      </section>

      {/* STEP 5 — supplemental */}
      <section className="pl-card">
        <div className="pl-step">5 · Go deeper (optional)</div>
        <div className="pl-suppintro">
          Upload the same dashboard exports you pull weekly — each gets its own slot. The planner
          summarizes them so you can see, e.g., that a Poor DSB tier is really just a few drivers.
        </div>
        <div className="pl-suppgrid">
          {SUPPLEMENTAL_SLOTS.map((slot) => {
            const s = supp[slot.key];
            return (
              <div className="pl-suppslot" key={slot.key}>
                <div className="pl-suppname">{slot.label}</div>
                <div className="pl-supphint">{slot.hint}</div>
                <label className="pl-suppbtn">
                  <input
                    key={`${slot.key}-${resetKey}`}
                    type="file"
                    accept=".csv,.tsv,text/csv"
                    onChange={(e) => handleSupp(slot.key, e.target.files?.[0])}
                  />
                  {s ? "Replace CSV" : "Choose CSV"}
                </label>
                {s && (
                  <div className="pl-suppsum">
                    <div className="pl-suppfile">{s.fileName}</div>
                    <div className="pl-suppmeta">
                      {s.rows.length} rows · {s.headers.length} columns
                    </div>
                    <div className="pl-suppcols">{s.headers.slice(0, 6).join(" · ")}{s.headers.length > 6 ? " …" : ""}</div>
                    <SuppTop data={s} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <footer className="pl-foot">
        Breez Global Logistics · Scorecard Planner. Tier thresholds are best-known estimates;
        your Overall is read directly from the scorecard and the breakdown is calibrated to it.
      </footer>
    </div>
  );
}

// Show the worst few rows of a supplemental CSV by the most defect-like numeric column.
function SuppTop({ data }) {
  const pick = useMemo(() => {
    const { headers, rows } = data;
    if (!rows.length) return null;
    const nameCol =
      headers.find((h) => /name|driver|da\b|associate|transporter/i.test(h)) || headers[0];
    // prefer a column that looks like a defect/count/dpmo
    const scoreCol =
      headers.find((h) => /dsb|dpmo|defect|count|concession|complaint|rts|escalation/i.test(h)) ||
      headers.find((h) => rows.some((r) => r[h] !== "" && !isNaN(Number(r[h]))));
    if (!scoreCol) return null;
    const ranked = rows
      .map((r) => ({ name: r[nameCol], v: Number(r[scoreCol]) }))
      .filter((r) => r.name && !isNaN(r.v))
      .sort((a, b) => b.v - a.v)
      .slice(0, 3);
    return { scoreCol, ranked };
  }, [data]);

  if (!pick || !pick.ranked.length) return null;
  return (
    <div className="pl-supptop">
      <div className="pl-supptoplab">Top by {pick.scoreCol}</div>
      {pick.ranked.map((r, i) => (
        <div className="pl-supptoprow" key={i}>
          <span>{r.name}</span>
          <b>{fmt(r.v)}</b>
        </div>
      ))}
    </div>
  );
}
