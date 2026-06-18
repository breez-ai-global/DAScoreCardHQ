"use client";

import Link from "next/link";
import DriverSwitcher from "./DriverSwitcher";
import DailyTable from "./DailyTable";
import Term from "./Term";
import { scoreTier, tierTipText } from "../lib/tiers";
import { useScope } from "./ScopeProvider";

function scoreColor(s) {
  if (s === null || s === undefined) return "var(--dusk)";
  if (s >= 85) return "var(--green)";
  if (s >= 70) return "var(--amber)";
  return "var(--red)";
}
function fmt(v, suffix = "") {
  if (v === null || v === undefined) return "—";
  return (typeof v === "number" ? (v % 1 === 0 ? v.toLocaleString() : v.toFixed(2)) : v) + suffix;
}

function Section({ kind, title, sub, entries }) {
  if (!entries || !entries.length) return null;
  return (
    <div className={`sev sev-${kind}`}>
      <div className="sev-head">{title} <span className="muted">· {sub}</span></div>
      <ul>
        {entries.map((e, i) => (
          <li key={i}>
            <b>{e.title}</b>
            {e.note && <div className="sev-note">{e.note}</div>}
            {e.items && (
              <div className="sev-items">
                {e.items.map((it, j) => (
                  <div key={j} className="sev-item">
                    • <b>{it.label}</b>
                    <div className="muted" style={{ fontSize: 12 }}>{it.date} {it.ref && `· ${it.ref}`}</div>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DeepDive({ id, roster, byScope, history, metricTierMap }) {
  const { scope, labels } = useScope();
  const cur = byScope[scope] || byScope.all;
  const scopeName = scope === "all" ? "all weeks (avg)" : labels[scope] || scope;

  if (!cur || !cur.rec) {
    return (
      <>
        <div className="panel" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div><b>Driver Deep-Dive</b><div className="muted" style={{ fontSize: 13 }}>Pick a driver to see what&apos;s going well, what needs work, and what&apos;s urgent.</div></div>
          <div style={{ marginLeft: "auto" }}><DriverSwitcher drivers={roster} currentId={id} /></div>
        </div>
        <div className="panel"><p className="muted">No scorecard for this driver in {scopeName}. Switch the week filter at the top, or pick &quot;All weeks&quot;.</p></div>
      </>
    );
  }

  const d = cur.rec;
  const t = scoreTier(d.overall ?? null, d.tierText || null);
  const color = scoreColor(d.overall);

  return (
    <>
      <div className="panel" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div><b>Driver Deep-Dive</b><div className="muted" style={{ fontSize: 13 }}>Showing {scopeName}. Use the week filter at the top to change the window.</div></div>
        <div style={{ marginLeft: "auto" }}><DriverSwitcher drivers={roster} currentId={id} /></div>
      </div>

      <div className="panel" style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ fontSize: 44, fontWeight: 800, color }}>{d.overall ?? "—"}</div>
        <div>
          <h1 className="page-title" style={{ marginBottom: 2 }}>
            {d.name}{" "}
            {t.label &&
              (t.amazon ? (
                <span className="term" tabIndex={0} data-tip={tierTipText(t, d.overall)}>
                  <span className={`pill ${t.cls}`}>{t.label}</span>
                </span>
              ) : (
                <span className={`pill ${t.cls}`}>{t.label}</span>
              ))}
          </h1>
          <div className="muted" style={{ fontSize: 13.5 }}>
            ID {id} · {fmt(d.delivered)} packages {scope === "all" ? `over ${d.weeksActive} wk` : `in ${scopeName}`} ·{" "}
            <Term k="Completion">Completion</Term> {fmt(d.dcr, "%")} ·{" "}
            <Term k="Photos">Photos</Term> {fmt(d.pod, "%")} ·{" "}
            <Term k="Complaints">{`${cur.complaints} complaint(s)`}</Term>
          </div>
        </div>
        <div className="no-print" style={{ marginLeft: "auto" }}>
          <Link className="btn" href={`/coaching?driver=${encodeURIComponent(id)}`}>✎ Coaching Report</Link>
        </div>
      </div>

      <Section kind="severe" title="🚨 SEVERE — FIX THIS NOW" sub="events actively hurting the scorecard or a safety/liability risk" entries={cur.severe} />
      <Section kind="improve" title="⚠ NEEDS IMPROVEMENT" sub="specific things to coach" entries={cur.improve} />
      <Section kind="grow" title="🌱 ROOM TO GROW" sub="near-misses and easy wins to the next tier" entries={cur.grow} />
      <Section kind="well" title="✅ DOING WELL — CALL IT OUT" sub="recognize these in the next standup" entries={cur.well} />

      <div className="panel">
        <h2>Weekly History</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Week</th><th><Term k="Score">Score</Term></th><th><Term k="Delivered">Delivered</Term></th><th><Term k="DCR">DCR</Term></th><th><Term k="DSB">DSB</Term></th><th><Term k="POD">POD</Term></th><th><Term k="CDF">CDF</Term></th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.week} style={h.week === scope ? { background: "rgba(173,173,251,0.08)" } : undefined}>
                  <td>{h.week}</td>
                  <td>{fmt(h.overall)}</td>
                  <td>{fmt(h.delivered)}</td>
                  <td className={metricTierMap.dcr[h.week] || ""}>{fmt(h.dcr, h.dcr !== null ? "%" : "")}</td>
                  <td>{fmt(h.dsb)}</td>
                  <td className={metricTierMap.pod[h.week] || ""}>{fmt(h.pod, h.pod !== null ? "%" : "")}</td>
                  <td className={metricTierMap.cdf[h.week] || ""}>{fmt(h.cdf)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {cur.dailyRows && cur.dailyRows.length > 0 && (
        <div className="panel">
          <h2>Daily Breakdown</h2>
          <DailyTable rows={cur.dailyRows} />
        </div>
      )}
    </>
  );
}
