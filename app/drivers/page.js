import Link from "next/link";
import Shell from "../../components/Shell";
import {
  loadData,
  latestWeek,
  allWeeks,
  driversForWeek,
  rankScore,
  fmt,
  metricTier,
  tierClass,
} from "../../lib/data";

export const dynamic = "force-static";

export default function DriversPage() {
  const data = loadData();
  const week = latestWeek(data);
  const weeks = allWeeks(data);
  const drivers = week ? driversForWeek(week, data) : [];
  const sorted = [...drivers].sort((a, b) => rankScore(b) - rankScore(a));

  return (
    <Shell>
      <h1 className="page-title">Drivers</h1>
      <p className="page-sub">
        {sorted.length} drivers · weeks loaded: {weeks.join(", ") || "none"}
      </p>

      <div className="panel">
        <table className="data">
          <thead>
            <tr>
              <th>#</th>
              <th>Driver</th>
              <th>Tier</th>
              <th>Score</th>
              <th>Delivered</th>
              <th>DCR</th>
              <th>DSB</th>
              <th>POD</th>
              <th>CDF</th>
              <th>Feedback</th>
              <th>Concessions</th>
              <th>RTS</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d, i) => {
              const [, dcrClass] = metricTier(d.dcr, "dcr");
              const [, podClass] = metricTier(d.pod, "pod");
              const [, cdfClass] = metricTier(d.cdf, "cdf");
              return (
                <tr key={d.id}>
                  <td className="muted">{i + 1}</td>
                  <td>
                    <Link href={`/drivers/${encodeURIComponent(d.id)}`}>{d.name}</Link>
                  </td>
                  <td>
                    {d.tierText ? (
                      <span className={`pill ${tierClass(d.tierText)}`}>{d.tierText}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>{fmt(d.overall)}</td>
                  <td>{fmt(d.delivered)}</td>
                  <td className={dcrClass}>{fmt(d.dcr, d.dcr !== null ? "%" : "")}</td>
                  <td>{fmt(d.dsb)}</td>
                  <td className={podClass}>{fmt(d.pod, d.pod !== null ? "%" : "")}</td>
                  <td className={cdfClass}>{fmt(d.cdf)}</td>
                  <td>{d.feedbackCount || 0}</td>
                  <td>{d.concessionCount || 0}</td>
                  <td>{d.rtsEventCount || 0}</td>
                  <td>
                    <Link href={`/coaching?driver=${encodeURIComponent(d.id)}`}>Coach →</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
