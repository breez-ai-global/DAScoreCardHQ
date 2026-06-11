import Link from "next/link";
import Shell from "../../../components/Shell";
import DriverSwitcher from "../../../components/DriverSwitcher";
import DailyTable from "../../../components/DailyTable";
import Term from "../../../components/Term";
import {
  loadData,
  allWeeks,
  latestWeek,
  driversForWeek,
  rankScore,
  fmt,
  pick,
  metricTier,
  effectiveTier,
} from "../../../lib/data";
import { driverInsights, scoreBand } from "../../../lib/insights";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  const data = loadData();
  const ids = new Set();
  for (const wk of allWeeks(data)) {
    for (const d of driversForWeek(wk, data)) ids.add(d.id);
  }
  return [...ids].map((id) => ({ id: encodeURIComponent(id) }));
}

function Section({ kind, title, sub, entries }) {
  if (!entries.length) return null;
  return (
    <div className={`sev sev-${kind}`}>
      <div className="sev-head">
        {title} <span className="muted">· {sub}</span>
      </div>
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
                    <div className="muted" style={{ fontSize: 12 }}>
                      {it.date} {it.ref && `· ${it.ref}`}
                    </div>
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

export default function DriverDetail({ params }) {
  const id = decodeURIComponent(params.id);
  const data = loadData();
  const weeks = allWeeks(data);
  const week = latestWeek(data);
  const roster = week
    ? driversForWeek(week, data).sort((a, b) => rankScore(b) - rankScore(a))
    : [];
  const history = weeks
    .map((wk) => driversForWeek(wk, data).find((d) => d.id === id))
    .filter(Boolean);
  // Anchor on the latest week with full scorecard data (the in-progress week
  // only has partial delivery numbers).
  const current = history.find((h) => h.week === week) || history[history.length - 1];
  if (!current)
    return (
      <Shell>
        <h1 className="page-title">Driver not found</h1>
        <Link href="/drivers">← Back to drivers</Link>
      </Shell>
    );

  const ins = driverInsights(current, data);
  const [, scoreColor] = scoreBand(current.overall);

  const days = Object.keys(data.daily).sort();
  const dailyRows = days
    .map((day) => {
      const row = (data.daily[day] || []).find((r) => {
        const rid = pick(r, "transporter id") || "";
        const rname = pick(r, "delivery associate", "name") || "";
        return rid === id || rname.toLowerCase() === current.name.toLowerCase();
      });
      return row ? { day, row } : null;
    })
    .filter(Boolean);

  return (
    <Shell>
      <div className="panel" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <b>Driver Deep-Dive</b>
          <div className="muted" style={{ fontSize: 13 }}>
            Pick a driver to see what&apos;s going well, what needs work, and what&apos;s urgent.
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <DriverSwitcher drivers={roster} currentId={id} />
        </div>
      </div>

      <div className="panel" style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ fontSize: 44, fontWeight: 800, color: scoreColor }}>{current.overall ?? "—"}</div>
        <div>
          <h1 className="page-title" style={{ marginBottom: 2 }}>
            {current.name}{" "}
            {(() => {
              const t = effectiveTier(current);
              if (!t.label) return null;
              return t.amazon ? (
                <span className="term" tabIndex={0} data-tip={`Amazon's official tier is ${t.amazon}, but a sub-70 overall score is a problem week — shown as At Risk.`}>
                  <span className={`pill ${t.cls}`}>{t.label}</span>
                </span>
              ) : (
                <span className={`pill ${t.cls}`}>{t.label}</span>
              );
            })()}
          </h1>
          <div className="muted" style={{ fontSize: 13.5 }}>
            ID {id} · {fmt(current.delivered)} packages in {current.week} ·{" "}
            <Term k="Completion">Completion</Term> {fmt(current.dcr, "%")} ·{" "}
            <Term k="Photos">Photos</Term> {fmt(current.pod, "%")} ·{" "}
            <Term k="Complaints">{`${ins.events.feedback.length} complaint(s)`}</Term>
          </div>
        </div>
        <div className="no-print" style={{ marginLeft: "auto" }}>
          <Link className="btn" href={`/coaching?driver=${encodeURIComponent(id)}`}>
            ✎ Coaching Report
          </Link>
        </div>
      </div>

      <Section
        kind="severe"
        title="🚨 SEVERE — FIX THIS NOW"
        sub="events that are actively hurting the scorecard or are a safety/liability risk"
        entries={ins.severe}
      />
      <Section
        kind="improve"
        title="⚠ NEEDS IMPROVEMENT"
        sub="specific things to coach this week"
        entries={ins.improve}
      />
      <Section
        kind="grow"
        title="🌱 ROOM TO GROW"
        sub="near-misses and easy wins to get to the next tier"
        entries={ins.grow}
      />
      <Section
        kind="well"
        title="✅ DOING WELL — CALL IT OUT"
        sub="recognize these in the next standup"
        entries={ins.well}
      />

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
                <tr key={h.week}>
                  <td>{h.week}</td>
                  <td>{fmt(h.overall)}</td>
                  <td>{fmt(h.delivered)}</td>
                  <td className={metricTier(h.dcr, "dcr")[1]}>{fmt(h.dcr, h.dcr !== null ? "%" : "")}</td>
                  <td>{fmt(h.dsb)}</td>
                  <td className={metricTier(h.pod, "pod")[1]}>{fmt(h.pod, h.pod !== null ? "%" : "")}</td>
                  <td className={metricTier(h.cdf, "cdf")[1]}>{fmt(h.cdf)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dailyRows.length > 0 && (
        <div className="panel">
          <h2>Daily Breakdown</h2>
          <DailyTable
            rows={dailyRows.map(({ day, row }) => ({
              day,
              delivered: pick(row, "packages delivered", "delivered") || "—",
              dcr: pick(row, "dcr") || "—",
              pod: pick(row, "pod") || "—",
              cdf: pick(row, "cdf dpmo", "cdf") || "—",
              dsb: pick(row, "dsb") || "—",
            }))}
          />
        </div>
      )}
    </Shell>
  );
}
