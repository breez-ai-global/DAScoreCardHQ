"use client";

import Link from "next/link";
import Avatar from "./Avatar";
import Term from "./Term";
import { scoreTier, tierTipText } from "../lib/tiers";
import { useScope } from "./ScopeProvider";

function scoreColor(s) {
  if (s === null || s === undefined) return "var(--dusk)";
  if (s >= 85) return "var(--green)";
  if (s >= 70) return "var(--amber)";
  return "var(--red)";
}

function fmt(v) {
  if (v === null || v === undefined) return "—";
  return typeof v === "number" ? (v % 1 === 0 ? v.toLocaleString() : v.toFixed(2)) : v;
}

function DriverCard({ d, rank }) {
  const color = scoreColor(d.overall);
  const t = scoreTier(d.overall ?? null, d.tierText || null);
  const events = (d.feedbackCount || 0) + (d.concessionCount || 0) + (d.rtsEventCount || 0);
  const amazonGap =
    d.amazonOverall !== null && d.amazonOverall !== undefined && d.overall !== null
      ? Math.round((d.overall - d.amazonOverall) * 10) / 10
      : null;
  return (
    <Link href={`/drivers/${encodeURIComponent(d.id)}`} className="dcard">
      <div className="head">
        <Avatar name={d.name} size={34} />
        <div>
          <div className="nm">{d.name}</div>
          {t.label &&
            (t.amazon ? (
              <span className="term" tabIndex={0} data-tip={tierTipText(t, d.overall)}>
                <span className={`pill ${t.cls}`}>{t.label}</span>
              </span>
            ) : (
              <span className={`pill ${t.cls}`}>{t.label}</span>
            ))}
        </div>
        <span className="rank">#{rank}</span>
      </div>

      <div>
        <div className="score-row">
          <span className="big" style={{ color }}>{d.overall ?? "—"}</span>
          <span className="muted" style={{ fontSize: 12 }}>
            Breez score{d.weeksActive > 1 ? ` · ${d.weeksActive} wks` : ""}
          </span>
        </div>
        <div className="meter" style={{ marginTop: 8 }}>
          <span style={{ width: `${d.overall ?? 0}%`, background: color }} />
        </div>
        {d.amazonOverall !== null && d.amazonOverall !== undefined && (
          <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
            Amazon score {fmt(d.amazonOverall)}
            {amazonGap !== null && amazonGap !== 0 && (
              <span style={{ color: amazonGap > 0 ? "var(--green)" : "var(--red)" }}>
                {" "}({amazonGap > 0 ? "+" : ""}{amazonGap} on Breez scale)
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mini">
        <div>
          <div className="k"><Term k="Delivered">Volume</Term></div>
          <div className="v">{fmt(d.delivered)}</div>
        </div>
        <div>
          <div className="k"><Term k="Completion">Completion</Term></div>
          <div className="v" style={{ color: d.dcr !== null && d.dcr < 99 ? "var(--amber)" : undefined }}>
            {d.dcr !== null ? d.dcr + "%" : "—"}
          </div>
        </div>
        <div>
          <div className="k"><Term k="Photos">Photos</Term></div>
          <div className="v" style={{ color: d.pod !== null && d.pod < 98 ? "var(--red)" : undefined }}>
            {d.pod !== null ? d.pod + "%" : "—"}
          </div>
        </div>
      </div>

      <div className="chips">
        {d.feedbackCount > 0 && <span className="chip bad">{d.feedbackCount} complaint{d.feedbackCount > 1 ? "s" : ""}</span>}
        {d.controllableRtsCount > 0 && <span className="chip warn">{d.controllableRtsCount} controllable RTS</span>}
        {d.concessionCount > 0 && <span className="chip warn">{d.concessionCount} concession{d.concessionCount > 1 ? "s" : ""}</span>}
        {events === 0 && <span className="chip ok">clean ✓</span>}
      </div>
    </Link>
  );
}

export default function DriversView({ byScope }) {
  const { scope, labels } = useScope();
  const sorted = byScope[scope] || byScope.all;
  const scopeName = scope === "all" ? "aggregated across all weeks" : labels[scope] || scope;

  // Breez composite buckets — best at top, worst at bottom.
  const performing = sorted.filter((d) => d.overall !== null && d.overall >= 90);
  const needsWork = sorted.filter((d) => d.overall !== null && d.overall >= 70 && d.overall < 90);
  const atRisk = sorted.filter((d) => d.overall !== null && d.overall < 70);
  const unrated = sorted.filter((d) => d.overall === null || d.overall === undefined);

  return (
    <>
      <h1 className="page-title">Driver by Driver</h1>
      <p className="page-sub">
        {sorted.length} drivers · {scopeName} · ranked by Breez composite score (volume, returns,
        complaints & concessions) · tap a card for the full deep-dive
      </p>

      <div className="kicker" style={{ color: "var(--green)" }}>✅ Performing well ({performing.length})</div>
      <div className="driver-grid">
        {performing.map((d) => <DriverCard key={d.id} d={d} rank={sorted.indexOf(d) + 1} />)}
        {!performing.length && <p className="muted">No drivers in this band for {scopeName}.</p>}
      </div>

      <div className="kicker" style={{ color: "var(--amber)" }}>👀 Needs work ({needsWork.length})</div>
      <div className="driver-grid">
        {needsWork.map((d) => <DriverCard key={d.id} d={d} rank={sorted.indexOf(d) + 1} />)}
        {!needsWork.length && <p className="muted">No drivers in this band for {scopeName}.</p>}
      </div>

      <div className="kicker" style={{ color: "var(--red)" }}>🚨 At risk — worst performers ({atRisk.length})</div>
      <div className="driver-grid">
        {atRisk.map((d) => <DriverCard key={d.id} d={d} rank={sorted.indexOf(d) + 1} />)}
        {!atRisk.length && <p className="muted">Nobody in the at-risk band for {scopeName}. 🎉</p>}
      </div>

      {unrated.length > 0 && (
        <>
          <div className="kicker">◦ Not yet rated ({unrated.length})</div>
          <div className="driver-grid">
            {unrated.map((d) => <DriverCard key={d.id} d={d} rank={sorted.indexOf(d) + 1} />)}
          </div>
        </>
      )}
    </>
  );
}
