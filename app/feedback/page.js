import Shell from "../../components/Shell";
import FeedList from "../../components/FeedList";
import { HBars } from "../../components/Charts";
import { loadData, pick } from "../../lib/data";
import { complaintType } from "../../lib/insights";

export const dynamic = "force-static";

const SEVERITY = {
  "Customer says it never arrived": "bad",
  "Delivered to the wrong address": "bad",
  "Package was mishandled": "bad",
  "Driver was unprofessional": "bad",
  "Didn't follow delivery instructions": "warn",
  "Customer received the wrong item": "warn",
};

export default function FeedbackPage() {
  const data = loadData();
  const events = [...data.events.feedback].sort((a, b) =>
    (pick(b, "delivery date") || "").localeCompare(pick(a, "delivery date") || "")
  );

  const byType = {};
  const byDriver = {};
  for (const e of events) {
    const t = complaintType(e);
    byType[t] = (byType[t] || 0) + 1;
    const n = pick(e, "delivery associate name") || "Unknown";
    byDriver[n] = (byDriver[n] || 0) + 1;
  }
  const repeat = Object.entries(byDriver).filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]);

  return (
    <Shell>
      <h1 className="page-title">Negative Feedback</h1>
      <p className="page-sub">Every negative customer comment, newest first — in plain English.</p>

      <div className="cards">
        <div className="card lift-a">
          <div className="label">Total complaints</div>
          <div className="value">{events.length}</div>
          <div className="tier muted">across loaded weeks</div>
        </div>
        <div className="card">
          <div className="label">Drivers involved</div>
          <div className="value">{Object.keys(byDriver).length}</div>
        </div>
        <div className="card">
          <div className="label">Repeat offenders</div>
          <div className="value tier-poor">{repeat.length}</div>
          <div className="tier muted">{repeat.slice(0, 2).map(([n]) => n.split(" ")[0]).join(", ") || "none"}</div>
        </div>
        <div className="card">
          <div className="label">Top complaint</div>
          <div className="value" style={{ fontSize: 16, lineHeight: 1.4 }}>
            {Object.entries(byType).sort((a, b) => b[1] - a[1])[0]?.[0] || "—"}
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>What customers said, by type</h2>
        <HBars items={Object.entries(byType).sort((a, b) => b[1] - a[1])} color="var(--red)" />
      </div>

      <div className="kicker">All complaints — filter by date below</div>
      <FeedList
        emptyText="No complaints in this range. 🎉"
        items={events.map((e) => {
          const t = complaintType(e);
          return {
            name: pick(e, "delivery associate name") || "Unknown",
            driverId: pick(e, "delivery associate") || "",
            tag: t,
            tagClass: SEVERITY[t] || "warn",
            quote: pick(e, "feedback details") ? `“${pick(e, "feedback details")}”` : null,
            meta: pick(e, "tracking id"),
            when: (pick(e, "delivery date") || "").slice(0, 10),
          };
        })}
      />
    </Shell>
  );
}
