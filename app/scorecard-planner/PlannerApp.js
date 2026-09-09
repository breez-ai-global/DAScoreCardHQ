"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Logo from "../../components/Logo";
import {
  METRICS,
  THRESHOLDS,
  SUPPLEMENTAL_SLOTS,
  rawToSubScore,
  subScoreTier,
  computeOverall,
  rankLevers,
  calibrationOffset,
  projectOverall,
  parseScorecardText,
  overallTier,
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

export default function PlannerApp() {
  const [pdfReady, setPdfReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [values, setValues] = useState({}); // {key: raw}
  const [printedOverall, setPrintedOverall] = useState(null);
  const [printedTier, setPrintedTier] = useState(null);
  const [parseInfo, setParseInfo] = useState(null);
  const [whatIf, setWhatIf] = useState({}); // key -> raw override
  const [supp, setSupp] = useState({}); // slotKey -> {fileName, headers, rows}
  const [target, setTarget] = useState(90);

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

  async function handlePdf(file) {
    if (!file) return;
    setBusy(true);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
      let text = "";
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        // Reconstruct lines by y-position so label + value stay together.
        const byLine = {};
        for (const it of content.items) {
          const y = Math.round(it.transform[5]);
          (byLine[y] = byLine[y] || []).push(it.str);
        }
        const ys = Object.keys(byLine).map(Number).sort((a, b) => b - a);
        for (const y of ys) text += byLine[y].join(" ") + "\n";
        text += "\n";
      }
      const parsed = parseScorecardText(text);
      setValues((v) => ({ ...v, ...parsed.values }));
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
    setValues((v) => ({ ...v, [key]: raw === "" ? undefined : Number(raw) }));
    setWhatIf((w) => { const n = { ...w }; delete n[key]; return n; });
  }

  // ── computed model ──
  const model = useMemo(() => computeOverall(values), [values]);
  const offset = useMemo(
    () => calibrationOffset(printedOverall, model.overall),
    [printedOverall, model.overall]
  );
  const levers = useMemo(() => rankLevers(values, target), [values, target]);

  const whatIfResult = useMemo(
    () => projectOverall(values, whatIf, offset),
    [values, whatIf, offset]
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
        <span className="pl-priv">Processed in your browser · nothing is uploaded or stored</span>
      </header>

      {/* STEP 1 — upload / enter */}
      <section className="pl-card">
        <div className="pl-step">1 · Load your scorecard</div>
        <div className="pl-upgrid">
          <label className={`pl-drop${busy ? " busy" : ""}`}>
            <input
              type="file"
              accept="application/pdf"
              disabled={!pdfReady || busy}
              onChange={(e) => handlePdf(e.target.files?.[0])}
            />
            <span className="pl-drop-big">
              {busy ? "Reading…" : "Drop / choose a scorecard PDF"}
            </span>
            <span className="pl-drop-small">
              {pdfReady ? "Auto-reads the printed numbers" : "Loading PDF reader…"}
            </span>
            {fileName && <span className="pl-file">{fileName}</span>}
          </label>
          <div className="pl-note">
            No PDF? Type the raw numbers into the table below — everything still works.
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
                const t = subScoreTier(sub);
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
              <option value={70}>70 (Great)</option>
              <option value={90}>90 (Fantastic)</option>
              <option value={100}>100 (max)</option>
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

      {/* STEP 4 — what-if */}
      {hasData && (
        <section className="pl-card">
          <div className="pl-step">4 · What-if planner</div>
          <div className="pl-whatif">
            <div className="pl-wi-controls">
              {METRICS.filter((m) => values[m.key] !== undefined).map((m) => {
                const cur = whatIf[m.key] ?? values[m.key];
                const dir = THRESHOLDS[m.key]?.dir;
                const th = THRESHOLDS[m.key];
                // slider range: from a strong value to a weak one
                const lo = dir === "up" ? (th.fair - (th.great - th.fair)) : 0;
                const hi = dir === "up" ? 100 : th.fair + (th.fair - th.great) * 2;
                return (
                  <div className="pl-wi-row" key={m.key}>
                    <div className="pl-wi-lab">
                      {m.label}
                      <span className="pl-wi-cur">{fmt(cur)} {m.unit}</span>
                    </div>
                    <input
                      type="range"
                      min={Math.min(lo, hi)}
                      max={Math.max(lo, hi)}
                      step={(Math.max(lo, hi) - Math.min(lo, hi)) / 100 || 1}
                      value={cur}
                      onChange={(e) =>
                        setWhatIf((w) => ({ ...w, [m.key]: Number(e.target.value) }))
                      }
                    />
                  </div>
                );
              })}
              {Object.keys(whatIf).length > 0 && (
                <button className="pl-reset" onClick={() => setWhatIf({})}>Reset to actual</button>
              )}
            </div>
            <div className="pl-wi-out">
              <div className="pl-wi-outlab">Projected Overall</div>
              <div className="pl-wi-outnum">
                {whatIfResult.calibrated === null ? "—" : fmt(whatIfResult.calibrated)}
              </div>
              <div className={`pl-wi-outtier ${TIER_CLS[overallTier(whatIfResult.calibrated).label] || "tier-nodata"}`}>
                {overallTier(whatIfResult.calibrated).label || "—"}
              </div>
              {baselineDisplay !== null && whatIfResult.calibrated !== null && (
                <div className="pl-wi-delta">
                  {whatIfResult.calibrated - baselineDisplay >= 0 ? "▲ +" : "▼ "}
                  {fmt(whatIfResult.calibrated - baselineDisplay)} vs current
                </div>
              )}
            </div>
          </div>
        </section>
      )}

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
