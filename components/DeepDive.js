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
function tierCls(t) {
  const s = (t || "").toLowerCase();
  if (s.includes("platinum")) return "platinum";
  if (s.includes("gold")) return "gold";
  if (s.includes("silver")) return "silver";
  if (s.includes("bronze")) return "bronze";
  if (s.includes("risk")) return "risk";
  return "neutral";
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
  const sp = d.scoreParts;
  const amazonGap =
    d.amazonOverall !== null && d.amazonOverall !== undefined && d.overall !== null
      ? Math.round((d.overall - d.amazonOverall) * 10) / 10
      : null;

  return (
    <>
      <div className="panel" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div><b>Driver Deep-Dive</b><div className="muted" style={{ fontSize: 13 }}>Showing {scopeName}. Use the week filter at the top to change the window.</div></div>
        <div style={{ marginLeft: "auto" }}><DriverSwitcher drivers={roster} currentId={id} /></div>
      </div>

      <div className="panel" style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 44, fontWeight: 800, color, lineHeight: 1 }}>{d.overall ?? "—"}</div>
          <div className="muted" style={{ fontSize: 10.5, letterSpacing: 0.4, textTransform: "uppercase" }}>Breez score</div>
        </div>
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
          {d.amazonOverall !== null && d.amazonOverall !== undefined && (
            <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
              Amazon raw score {fmt(d.amazonOverall)}
              {amazonGap !== null && amazonGap !== 0 && (
                <span style={{ color: amazonGap > 0 ? "var(--green)" : "var(--red)" }}>
                  {" "}— Breez {amazonGap > 0 ? "adds" : "deducts"} {Math.abs(amazonGap)} for volume, defects &amp; safety
                </span>
              )}
            </div>
          )}
        </div>
        <div className="no-print" style={{ marginLeft: "auto" }}>
          <Link className="btn" href={`/coaching?driver=${encodeURIComponent(id)}`}>✎ Coaching Report</Link>
        </div>
      </div>

      {sp && sp.base !== null && (
        <div className="panel">
          <h2>How the Breez score is built</h2>
          <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
            Starts from Amazon&apos;s raw score, rewards proven volume at quality, and deducts for
            returns, complaints, concessions, and Netradyne driving-safety events.
          </p>
          <div className="score-build">
            <div className="sb-item">
              <div className="sb-label">Amazon base</div>
              <div className="sb-val">{fmt(sp.base)}</div>
            </div>
            <div className="sb-op">+</div>
            <div className="sb-item">
              <div className="sb-label">Volume × quality bonus</div>
              <div className="sb-val" style={{ color: sp.bonus > 0 ? "var(--green)" : "var(--txt-2)" }}>
                {sp.bonus > 0 ? `+${fmt(sp.bonus)}` : "0"}
              </div>
            </div>
            <div className="sb-op">−</div>
            <div className="sb-item">
              <div className="sb-label">Defect penalty</div>
              <div className="sb-val" style={{ color: sp.penalty > 0 ? "var(--red)" : "var(--txt-2)" }}>
                {sp.penalty > 0 ? `−${fmt(sp.penalty)}` : "0"}
              </div>
            </div>
            <div className="sb-op">−</div>
            <div className="sb-item">
              <div className="sb-label">Driving safety</div>
              <div className="sb-val" style={{ color: sp.safetyPts > 0 ? "var(--red)" : "var(--txt-2)" }}>
                {sp.safetyPts > 0 ? `−${fmt(sp.safetyPts)}` : "0"}
              </div>
            </div>
            {sp.starBonus > 0 && (
              <>
                <div className="sb-op">+</div>
                <div className="sb-item">
                  <div className="sb-label">DriverStars</div>
                  <div className="sb-val" style={{ color: "var(--green)" }}>+{fmt(sp.starBonus)}</div>
                </div>
              </>
            )}
            <div className="sb-op">=</div>
            <div className="sb-item">
              <div className="sb-label">Breez score</div>
              <div className="sb-val" style={{ color, fontWeight: 800 }}>{fmt(d.overall)}</div>
            </div>
          </div>
          {sp.penalty > 0 && (
            <div className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
              Penalty breakdown:{" "}
              {sp.parts.compPts > 0 && <span>complaints −{fmt(sp.parts.compPts)}{(sp.parts.rtsPts > 0 || sp.parts.concPts > 0) ? " · " : ""}</span>}
              {sp.parts.rtsPts > 0 && <span>controllable returns −{fmt(sp.parts.rtsPts)}{sp.parts.concPts > 0 ? " · " : ""}</span>}
              {sp.parts.concPts > 0 && <span>concessions −{fmt(sp.parts.concPts)}</span>}
              {" "}(from {sp.parts.complaints} complaint(s), {sp.parts.controllableRts} controllable RTS, {sp.parts.concessions} concession(s))
            </div>
          )}
        </div>
      )}

      {d.safety && d.safety.total > 0 && (
        <div className="panel">
          <h2>🚗 Driving Safety — Netradyne (last 30 days)</h2>
          <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
            On-road behavior from the Driver·i cameras. Driving events count against the score
            harder than customer feedback. Third-party-caused events are exempt.
          </p>
          <div className="chips" style={{ marginBottom: 10 }}>
            {d.safety.drowsiness > 0 && <span className="chip bad">{d.safety.drowsiness} drowsiness</span>}
            {d.safety.distraction > 0 && <span className="chip bad">{d.safety.distraction} distraction</span>}
            {d.safety.following > 0 && <span className="chip bad">{d.safety.following} following distance</span>}
            {d.safety.seatbelt > 0 && <span className="chip bad">{d.safety.seatbelt} seatbelt</span>}
            {d.safety.signSignal > 0 && <span className="chip bad">{d.safety.signSignal} sign/signal</span>}
            {d.safety.speeding > 0 && <span className="chip bad">{d.safety.speeding} speeding</span>}
            {d.safety.hardBraking > 0 && <span className="chip warn">{d.safety.hardBraking} hard braking</span>}
            {d.safety.accel > 0 && <span className="chip warn">{d.safety.accel} hard acceleration</span>}
            {d.safety.highG > 0 && <span className="chip warn">{d.safety.highG} high-G</span>}
            {d.safety.backing > 0 && <span className="chip">{d.safety.backing} backing</span>}
            {d.safety.thirdParty > 0 && <span className="chip ok">{d.safety.thirdParty} third-party (exempt)</span>}
            {d.safety.stars > 0 && <span className="chip ok">★ {d.safety.stars} DriverStar{d.safety.stars > 1 ? "s" : ""}</span>}
          </div>
          <div className="muted" style={{ fontSize: 12.5 }}>
            Weighted safety severity {fmt(sp?.parts?.safetySev)} → −{fmt(sp?.safetyPts)} points
            {sp?.starBonus > 0 ? `, DriverStars +${fmt(sp.starBonus)}` : ""}.
          </div>
        </div>
      )}

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
                <th>Week</th><th>Breez</th><th>Amazon</th><th><Term k="Delivered">Delivered</Term></th><th><Term k="DCR">DCR</Term></th><th><Term k="DSB">DSB</Term></th><th><Term k="POD">POD</Term></th><th><Term k="CDF">CDF</Term></th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.week} style={h.week === scope ? { background: "rgba(173,173,251,0.08)" } : undefined}>
                  <td>{h.week}</td>
                  <td style={{ fontWeight: 700 }}>{fmt(h.overall)}</td>
                  <td className="muted">{fmt(h.amazonOverall)}</td>
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
