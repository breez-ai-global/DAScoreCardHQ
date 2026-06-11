import Link from "next/link";
import Shell from "../components/Shell";
import TeamTable from "../components/TeamTable";
import Term from "../components/Term";
import { Donut, HBars } from "../components/Charts";
import { loadData, latestWeek, fmt, pick, num } from "../lib/data";
import { overview, scoreBand } from "../lib/insights";

export const dynamic = "force-static";

export default function Dashboard() {
  const data = loadData();
  const o = overview(data);

  const flagsByDriver = {};
  for (const f of o.disputes) {
    const k = f.driverId || f.driver;
    flagsByDriver[k] = flagsByDriver[k] || { scan: 0, high: 0 };
    if (f.flag.toLowerCase().includes("scan")) flagsByDriver[k].scan++;
    if (f.priority === "High") flagsByDriver[k].high++;
  }
  const tableRows = o.ranked.map((d) => ({
    id: d.id,
    name: d.name,
    tierText: d.tierText,
    overall: d.overall,
    delivered: d.delivered,
    dcr: d.dcr,
    pod: d.pod,
    feedbackCount: d.feedbackCount || 0,
    scanFlags: (flagsByDriver[d.id] || flagsByDriver[d.name] || {}).scan || 0,
    urgent: (flagsByDriver[d.id] || flagsByDriver[d.name] || {}).high || 0,
  }));

  const attention = o.ranked.filter(
    (d) => (d.overall !== null && d.overall < 95) && (d.feedbackCount > 0 || d.concessionCount > 0 || (d.overall ?? 100) < 85)
  );

  const scoreItems = o.ranked
    .filter((d) => d.overall !== null)
    .map((d) => [d.name, d.overall, scoreBand(d.overall)[1]]);

  const complaintItems = Object.entries(o.complaints).sort((a, b) => b[1] - a[1]);
  const rtsItems = Object.entries(o.rtsReasons).sort((a, b) => b[1] - a[1]);
  const podItems = o.ranked
    .filter((d) => d.pod !== null)
    .sort((a, b) => a.pod - b.pod)
    .slice(0, 10)
    .map((d) => [d.name, d.pod, d.pod < 98 ? "var(--red)" : "var(--green)"]);

  return (
    <Shell>
      <h1 className="page-title">Business Overview</h1>
      <p className="page-sub">
        Week {o.week ? o.week.replace("2026-W", "") : "—"}, 2026 · Data refreshed{" "}
        {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : "—"}
      </p>

      <div className="cards">
        <div className="card lift-a">
          <div className="label"><Term k="Score">Team Avg Score</Term></div>
          <div className="value">{o.avgScore !== null ? o.avgScore.toFixed(1) : "—"}</div>
          <div className="tier muted">out of 100</div>
        </div>
        <div className="card">
          <div className="label"><Term k="Tier">Drivers at Platinum</Term></div>
          <div className="value tier-great">{o.platinum}/{o.total}</div>
          <div className="tier muted">top tier this week</div>
        </div>
        <div className="card lift-b">
          <div className="label"><Term k="Delivered">Packages Delivered</Term></div>
          <div className="value">{fmt(o.delivered)}</div>
          <div className="tier muted">across the whole team</div>
        </div>
        <div className="card">
          <div className="label"><Term k="CDF">Customer Complaints</Term></div>
          <div className="value tier-poor">{o.complaintsTotal}</div>
          <div className="tier muted">negative feedback events</div>
        </div>
        <div className="card">
          <div className="label"><Term k="Controllable Returns">Controllable Returns</Term></div>
          <div className="value tier-poor">{o.controllable}</div>
          <div className="tier muted">returns the team could have prevented</div>
        </div>
        <div className="card">
          <div className="label"><Term k="Urgent Items">Flagged for Dispute</Term></div>
          <div className="value tier-fair">{o.disputeCount}</div>
          <div className="tier"><Link href="/disputes">items worth a second look →</Link></div>
        </div>
      </div>

      <div className="panel">
        <h2>📝 This Week in Plain English</h2>
        <p className="plain">
          The team delivered <b>{fmt(o.delivered)} packages</b> this week with{" "}
          <b>{o.platinum} of {o.total} drivers in Platinum</b>. Top performers:{" "}
          <b>{o.top3.map((d) => shortName(d.name)).join(", ")}</b>.
        </p>
        {attention.length > 0 && (
          <p className="plain">
            🚨 <b>{attention.length} driver{attention.length > 1 ? "s" : ""} need immediate attention:</b>{" "}
            {attention.map((d, i) => (
              <span key={d.id}>
                <Link href={`/drivers/${encodeURIComponent(d.id)}`}>{d.name}</Link>
                {i < attention.length - 1 ? ", " : ""}
              </span>
            ))}
            . Open their cards in the Drivers tab for the exact events.
          </p>
        )}
        <p className="plain">
          ⚖ <b>{o.disputeCount} items were auto-flagged for possible dispute</b> — returns counting
          against DCR with no exemption, &quot;never received&quot; complaints that may be theft, and
          GPS-drift scan flags. Review them in the <Link href="/disputes">Dispute Center</Link>{" "}
          before the scorecard locks in.
        </p>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h2><Term k="Tier">Team Standing Mix</Term></h2>
          <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
            How many drivers landed in each tier this week. Anyone under a 70 score shows as At Risk
            — whatever Amazon calls them.
          </p>
          <Donut mix={o.mix} />
        </div>
        <div className="panel">
          <h2><Term k="CDF">What Customers Complained About</Term></h2>
          <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
            Every negative piece of customer feedback this week, grouped by type.
          </p>
          {complaintItems.length ? (
            <HBars items={complaintItems} color="var(--red)" />
          ) : (
            <p className="muted">No complaints recorded. 🎉</p>
          )}
        </div>
      </div>

      <div className="panel">
        <h2><Term k="Score">Driver Scores, Ranked</Term></h2>
        <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
          Overall weekly score out of 100. Green = safe (85+), yellow = watch (70–85), red = needs
          attention (&lt;70).
        </p>
        <HBars items={scoreItems} labelWidth={210} />
      </div>

      <div className="grid-2">
        <div className="panel">
          <h2><Term k="RTS">Why Packages Came Back to the Station</Term></h2>
          <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
            Every package returned undelivered (RTS), grouped by the reason the driver selected.
          </p>
          {rtsItems.length ? <HBars items={rtsItems} color="var(--amber)" /> : <p className="muted">No RTS events.</p>}
        </div>
        <div className="panel">
          <h2><Term k="POD">Photo Quality by Driver (POD)</Term></h2>
          <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
            % of delivery photos that passed Amazon&apos;s quality check. Below 98% starts costing
            points. Lowest ten shown.
          </p>
          {podItems.length ? <HBars items={podItems} valueSuffix="%" labelWidth={210} /> : <p className="muted">No POD data.</p>}
        </div>
      </div>

      <div className="panel">
        <h2>Full Team Table</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
          Click any column header to sort. Hover a header for what the code means. Click a driver
          for their full breakdown.
        </p>
        <TeamTable rows={tableRows} />
      </div>
    </Shell>
  );
}

function shortName(n) {
  const parts = (n || "").split(/\s+/);
  return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : n;
}
