import Link from "next/link";
import Shell from "../../components/Shell";
import Avatar from "../../components/Avatar";
import {
  loadData,
  latestWeek,
  driversForWeek,
  rankScore,
  fmt,
  tierClass,
} from "../../lib/data";
import { scoreBand } from "../../lib/insights";

export const dynamic = "force-static";

function DriverCard({ d, rank }) {
  const [, color] = scoreBand(d.overall);
  const events = (d.feedbackCount || 0) + (d.concessionCount || 0) + (d.rtsEventCount || 0);
  return (
    <Link href={`/drivers/${encodeURIComponent(d.id)}`} className="dcard">
      <div className="head">
        <Avatar name={d.name} size={34} />
        <div>
          <div className="nm">{d.name}</div>
          {d.tierText && <span className={`pill ${tierClass(d.tierText)}`}>{d.tierText}</span>}
        </div>
        <span className="rank">#{rank}</span>
      </div>

      <div>
        <div className="score-row">
          <span className="big" style={{ color }}>{d.overall ?? "—"}</span>
          <span className="muted" style={{ fontSize: 12 }}>weekly score</span>
        </div>
        <div className="meter" style={{ marginTop: 8 }}>
          <span style={{ width: `${d.overall ?? 0}%`, background: color }} />
        </div>
      </div>

      <div className="mini">
        <div>
          <div className="k">Delivered</div>
          <div className="v">{fmt(d.delivered)}</div>
        </div>
        <div>
          <div className="k">Completion</div>
          <div className="v" style={{ color: d.dcr !== null && d.dcr < 99 ? "var(--amber)" : undefined }}>
            {d.dcr !== null ? d.dcr + "%" : "—"}
          </div>
        </div>
        <div>
          <div className="k">Photos</div>
          <div className="v" style={{ color: d.pod !== null && d.pod < 98 ? "var(--red)" : undefined }}>
            {d.pod !== null ? d.pod + "%" : "—"}
          </div>
        </div>
      </div>

      <div className="chips">
        {d.feedbackCount > 0 && <span className="chip bad">{d.feedbackCount} complaint{d.feedbackCount > 1 ? "s" : ""}</span>}
        {d.concessionCount > 0 && <span className="chip warn">{d.concessionCount} concession{d.concessionCount > 1 ? "s" : ""}</span>}
        {d.rtsEventCount > 0 && <span className="chip">{d.rtsEventCount} RTS</span>}
        {events === 0 && <span className="chip ok">clean week ✓</span>}
      </div>
    </Link>
  );
}

export default function DriversPage() {
  const data = loadData();
  const week = latestWeek(data);
  const drivers = week ? driversForWeek(week, data) : [];
  const sorted = [...drivers].sort((a, b) => rankScore(b) - rankScore(a));

  const needsWork = sorted.filter((d) => d.overall !== null && d.overall < 85);
  const watch = sorted.filter((d) => d.overall !== null && d.overall >= 85 && d.overall < 95);
  const solid = sorted.filter((d) => d.overall === null || d.overall >= 95);

  return (
    <Shell>
      <h1 className="page-title">Driver by Driver</h1>
      <p className="page-sub">
        {sorted.length} drivers · week {week?.replace("2026-W", "") || "—"} · tap a card for the full deep-dive
      </p>

      {needsWork.length > 0 && (
        <>
          <div className="kicker" style={{ color: "var(--red)" }}>🚨 Needs attention ({needsWork.length})</div>
          <div className="driver-grid">
            {needsWork.map((d) => (
              <DriverCard key={d.id} d={d} rank={sorted.indexOf(d) + 1} />
            ))}
          </div>
        </>
      )}

      {watch.length > 0 && (
        <>
          <div className="kicker" style={{ color: "var(--amber)" }}>👀 Worth watching ({watch.length})</div>
          <div className="driver-grid">
            {watch.map((d) => (
              <DriverCard key={d.id} d={d} rank={sorted.indexOf(d) + 1} />
            ))}
          </div>
        </>
      )}

      <div className="kicker" style={{ color: "var(--green)" }}>✅ Performing well ({solid.length})</div>
      <div className="driver-grid">
        {solid.map((d) => (
          <DriverCard key={d.id} d={d} rank={sorted.indexOf(d) + 1} />
        ))}
      </div>
    </Shell>
  );
}
