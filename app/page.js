import Link from "next/link";
import Shell from "../components/Shell";
import {
  loadData,
  latestWeek,
  driversForWeek,
  rankScore,
  fmt,
  pick,
  num,
  metricTier,
  tierClass,
} from "../lib/data";

export const dynamic = "force-static";

function StationCards({ data }) {
  const weeks = data.station.weeks || [];
  if (!weeks.length) return null;
  const cols = Object.keys(weeks[0] || {}).filter((k) => /week/i.test(k));
  const last = cols[cols.length - 1];
  const find = (label) =>
    weeks.find((r) => (pick(r, "metric") || "").toLowerCase() === label.toLowerCase());
  const items = [
    ["Completed Routes", find("Completed Routes")],
    ["Delivered Packages", find("Delivered Packages")],
    ["Delivery Success %", find("Delivery Success (%)")],
    ["RTS Packages", find("Packages Returned to Station (RTS)")],
  ].filter(([, r]) => r);
  if (!items.length) return null;
  return (
    <div className="cards">
      {items.map(([label, row]) => (
        <div className="card" key={label}>
          <div className="label">{label} <span className="muted">({last})</span></div>
          <div className="value">{row[last] ?? "—"}</div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const data = loadData();
  const week = latestWeek(data);
  const drivers = week ? driversForWeek(week, data) : [];
  const active = drivers.filter((d) => (d.delivered || 0) > 0 || d.overall !== null);
  const sorted = [...active].sort((a, b) => rankScore(b) - rankScore(a));
  const top = sorted.slice(0, 5);
  const bottom = sorted.slice(-5).reverse();

  const totals = {
    delivered: active.reduce((s, d) => s + (d.delivered || 0), 0),
    feedback: data.events.feedback.length,
    concessions: data.events.concessions.length,
    rts: data.events.rts.length,
  };

  return (
    <Shell>
      <h1 className="page-title">Fleet Overview</h1>
      <p className="page-sub">
        {week ? `Latest full week: ${week.replace("-", " ")}` : "No data loaded yet"} ·
        Data refreshed {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : "—"}
      </p>

      <StationCards data={data} />

      <div className="cards">
        <div className="card">
          <div className="label">Active Drivers ({week || "—"})</div>
          <div className="value">{active.length}</div>
        </div>
        <div className="card">
          <div className="label">Packages Delivered</div>
          <div className="value">{fmt(totals.delivered)}</div>
        </div>
        <div className="card">
          <div className="label">Negative Feedback</div>
          <div className="value">{totals.feedback}</div>
          <div className={`tier ${totals.feedback > 10 ? "tier-poor" : "tier-great"}`}>
            {totals.feedback > 10 ? "Needs attention" : "Under control"}
          </div>
        </div>
        <div className="card">
          <div className="label">Concessions</div>
          <div className="value">{totals.concessions}</div>
        </div>
        <div className="card">
          <div className="label">RTS Events</div>
          <div className="value">{totals.rts}</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h2>🏆 Top Drivers</h2>
          <DriverTable drivers={top} />
        </div>
        <div className="panel">
          <h2>⚠ Needs Coaching</h2>
          <DriverTable drivers={bottom} showCoach />
        </div>
      </div>

      <div className="panel">
        <h2>All Drivers — {week || "no data"}</h2>
        <DriverTable drivers={sorted} showCoach />
      </div>
    </Shell>
  );
}

function DriverTable({ drivers, showCoach = false }) {
  if (!drivers.length)
    return <p className="muted">No driver data loaded. Drop CSVs into data/raw and rebuild.</p>;
  return (
    <table className="data">
      <thead>
        <tr>
          <th>Driver</th>
          <th>Score</th>
          <th>Delivered</th>
          <th>DCR</th>
          <th>POD</th>
          <th>CDF</th>
          <th>Events</th>
          {showCoach && <th></th>}
        </tr>
      </thead>
      <tbody>
        {drivers.map((d) => {
          const [, dcrClass] = metricTier(d.dcr, "dcr");
          const [, podClass] = metricTier(d.pod, "pod");
          const [, cdfClass] = metricTier(d.cdf, "cdf");
          const events = (d.feedbackCount || 0) + (d.concessionCount || 0) + (d.rtsEventCount || 0);
          return (
            <tr key={d.id}>
              <td>
                <Link href={`/drivers/${encodeURIComponent(d.id)}`}>{d.name}</Link>
                {d.tierText && (
                  <>
                    {" "}
                    <span className={`pill ${tierClass(d.tierText)}`}>{d.tierText}</span>
                  </>
                )}
              </td>
              <td>{fmt(d.overall)}</td>
              <td>{fmt(d.delivered)}</td>
              <td className={dcrClass}>{fmt(d.dcr, d.dcr !== null ? "%" : "")}</td>
              <td className={podClass}>{fmt(d.pod, d.pod !== null ? "%" : "")}</td>
              <td className={cdfClass}>{fmt(d.cdf)}</td>
              <td>{events > 0 ? <span className="pill risk">{events}</span> : <span className="muted">0</span>}</td>
              {showCoach && (
                <td>
                  <Link href={`/coaching?driver=${encodeURIComponent(d.id)}`}>Coach →</Link>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
