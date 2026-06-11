import Shell from "../../components/Shell";
import FeedList from "../../components/FeedList";
import { loadData, pick, num } from "../../lib/data";

export const dynamic = "force-static";

const REASONS = [
  ["Simultaneous Deliveries", "Simultaneous deliveries"],
  ["Delivered > 50 m", "Scanned >50m from drop point"],
  ["Incorrect Scan Usage - Attended Delivery", "Wrong scan type (attended)"],
  ["Incorrect Scan Usage - Unattended Delivery", "Wrong scan type (unattended)"],
  ["No POD on Delivery", "No delivery photo taken"],
  ["Scanned - Not Delivered - Not Returned", "Scanned but never delivered or returned"],
];

function reasonOf(e) {
  for (const [col, label] of REASONS) {
    const v = pick(e, col);
    if (v === "●" || num(v) === 1) return label;
  }
  return "Concession";
}

export default function ConcessionsPage() {
  const data = loadData();
  const events = [...data.events.concessions].sort((a, b) =>
    (pick(b, "concession date") || "").localeCompare(pick(a, "concession date") || "")
  );

  const impactsDsbVal = (e) => {
    const v = pick(e, "impacts dsb");
    return num(v) === 1 || /^y/i.test(v || "");
  };
  const dsbImpact = events.filter(impactsDsbVal);
  const unattended = events.filter((e) => /unattended/i.test(pick(e, "delivery type") || ""));
  const byDriver = {};
  for (const e of events) {
    const n = pick(e, "delivery associate name") || "Unknown";
    byDriver[n] = (byDriver[n] || 0) + 1;
  }
  const top = Object.entries(byDriver).sort((a, b) => b[1] - a[1])[0];

  return (
    <Shell>
      <h1 className="page-title">Concessions</h1>
      <p className="page-sub">
        Refunds Amazon issued for delivery problems — each one traces back to a specific package and behavior.
      </p>

      <div className="cards">
        <div className="card lift-b">
          <div className="label">Total concessions</div>
          <div className="value">{events.length}</div>
        </div>
        <div className="card">
          <div className="label">Hurting DSB score</div>
          <div className="value tier-poor">{dsbImpact.length}</div>
          <div className="tier muted">count against the scorecard</div>
        </div>
        <div className="card">
          <div className="label">Unattended drops</div>
          <div className="value">{unattended.length}</div>
          <div className="tier muted">left without a handoff</div>
        </div>
        <div className="card">
          <div className="label">Most involved</div>
          <div className="value" style={{ fontSize: 16, lineHeight: 1.4 }}>{top ? top[0] : "—"}</div>
          <div className="tier muted">{top ? `${top[1]} event(s)` : ""}</div>
        </div>
      </div>

      <div className="kicker">Every concession — filter by date below</div>
      <FeedList
        emptyText="No concessions in this range. 🎉"
        items={events.map((e) => {
          const impactsDsb = impactsDsbVal(e);
          return {
            name: pick(e, "delivery associate name") || "Unknown",
            driverId: pick(e, "delivery associate") || "",
            tag: reasonOf(e),
            tagClass: impactsDsb ? "bad" : "warn",
            quote: `${pick(e, "delivery type") || "—"} delivery${impactsDsb ? " · counting against DSB" : " · not scored"}`,
            meta: pick(e, "tracking id"),
            when: (pick(e, "concession date") || pick(e, "delivery date") || "").slice(0, 10),
          };
        })}
      />
    </Shell>
  );
}
