import Link from "next/link";
import Shell from "../../../components/Shell";
import {
  loadData,
  allWeeks,
  driversForWeek,
  driverEvents,
  fmt,
  pick,
  metricTier,
  tierClass,
} from "../../../lib/data";

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

export default function DriverDetail({ params }) {
  const id = decodeURIComponent(params.id);
  const data = loadData();
  const weeks = allWeeks(data);
  const history = weeks
    .map((wk) => driversForWeek(wk, data).find((d) => d.id === id))
    .filter(Boolean);
  const current = history[history.length - 1];
  if (!current)
    return (
      <Shell>
        <h1 className="page-title">Driver not found</h1>
        <Link href="/drivers">← Back to drivers</Link>
      </Shell>
    );

  const events = driverEvents(id, current.name, data);

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
      <p style={{ marginBottom: 8 }}>
        <Link href="/drivers">← Drivers</Link>
      </p>
      <h1 className="page-title">
        {current.name}{" "}
        {current.tierText && (
          <span className={`pill ${tierClass(current.tierText)}`}>{current.tierText}</span>
        )}
      </h1>
      <p className="page-sub">Transporter ID: {id}</p>

      <div className="cards">
        <Metric label="Overall Score" value={fmt(current.overall)} />
        <Metric label="Delivered" value={fmt(current.delivered)} />
        <Metric label="DCR" value={fmt(current.dcr, current.dcr !== null ? "%" : "")} cls={metricTier(current.dcr, "dcr")[1]} />
        <Metric label="POD" value={fmt(current.pod, current.pod !== null ? "%" : "")} cls={metricTier(current.pod, "pod")[1]} />
        <Metric label="CDF DPMO" value={fmt(current.cdf)} cls={metricTier(current.cdf, "cdf")[1]} />
        <Metric label="Neg. Feedback" value={events.feedback.length} cls={events.feedback.length ? "tier-poor" : "tier-great"} />
        <Metric label="Concessions" value={events.concessions.length} cls={events.concessions.length ? "tier-poor" : "tier-great"} />
        <Metric label="RTS Events" value={events.rts.length} cls={events.rts.length ? "tier-fair" : "tier-great"} />
      </div>

      <div className="toolbar no-print">
        <Link className="btn" href={`/coaching?driver=${encodeURIComponent(id)}`}>
          ✎ Create Coaching Report
        </Link>
      </div>

      <div className="panel">
        <h2>Weekly History</h2>
        <table className="data">
          <thead>
            <tr>
              <th>Week</th><th>Score</th><th>Delivered</th><th>DCR</th><th>DSB</th><th>POD</th><th>CDF</th>
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

      {dailyRows.length > 0 && (
        <div className="panel">
          <h2>Daily Breakdown</h2>
          <table className="data">
            <thead>
              <tr>
                <th>Date</th><th>Delivered</th><th>DCR</th><th>POD</th><th>CDF DPMO</th><th>DSB</th>
              </tr>
            </thead>
            <tbody>
              {dailyRows.map(({ day, row }) => (
                <tr key={day}>
                  <td>{day}</td>
                  <td>{pick(row, "packages delivered", "delivered") || "—"}</td>
                  <td>{pick(row, "dcr") || "—"}</td>
                  <td>{pick(row, "pod") || "—"}</td>
                  <td>{pick(row, "cdf dpmo", "cdf") || "—"}</td>
                  <td>{pick(row, "dsb") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EventPanel title="Negative Feedback" rows={events.feedback} />
      <EventPanel title="Concessions" rows={events.concessions} />
      <EventPanel title="Return to Station" rows={events.rts} />
    </Shell>
  );
}

function Metric({ label, value, cls = "" }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className={`value ${cls}`}>{value}</div>
    </div>
  );
}

function EventPanel({ title, rows }) {
  if (!rows.length) return null;
  const cols = Object.keys(rows[0]).filter(
    (k) => rows.some((r) => r[k] && r[k] !== "--")
  );
  return (
    <div className="panel">
      <h2>{title} ({rows.length})</h2>
      <div style={{ overflowX: "auto" }}>
        <table className="data">
          <thead>
            <tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>{cols.map((c) => <td key={c}>{r[c] || "—"}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
