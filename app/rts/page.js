import Shell from "../../components/Shell";
import FeedItem from "../../components/FeedItem";
import { HBars } from "../../components/Charts";
import { loadData, pick } from "../../lib/data";
import { rtsPlain } from "../../lib/insights";

export const dynamic = "force-static";

export default function RtsPage() {
  const data = loadData();
  const events = [...data.events.rts].sort((a, b) =>
    (pick(b, "planned delivery date") || "").localeCompare(pick(a, "planned delivery date") || "")
  );

  const hurting = events.filter((e) => (pick(e, "impact dcr") || "").toUpperCase() === "Y");
  const exempted = events.filter((e) => {
    const ex = pick(e, "exemption reason") || "";
    return ex && !/no exemption/i.test(ex) && ex !== "--";
  });
  const byReason = {};
  for (const e of events) {
    const r = rtsPlain(pick(e, "da selected rts code"));
    byReason[r] = (byReason[r] || 0) + 1;
  }

  return (
    <Shell>
      <h1 className="page-title">Return to Station</h1>
      <p className="page-sub">Every package that came back undelivered, and whether it&apos;s actually hurting the score.</p>

      <div className="cards">
        <div className="card lift-a">
          <div className="label">Packages returned</div>
          <div className="value">{events.length}</div>
        </div>
        <div className="card">
          <div className="label">Hurting DCR</div>
          <div className="value tier-poor">{hurting.length}</div>
          <div className="tier muted">no exemption applied</div>
        </div>
        <div className="card">
          <div className="label">Exempted</div>
          <div className="value tier-great">{exempted.length}</div>
          <div className="tier muted">excused, no score impact</div>
        </div>
        <div className="card">
          <div className="label">Top reason</div>
          <div className="value" style={{ fontSize: 16, lineHeight: 1.4 }}>
            {Object.entries(byReason).sort((a, b) => b[1] - a[1])[0]?.[0] || "—"}
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Why packages came back</h2>
        <HBars items={Object.entries(byReason).sort((a, b) => b[1] - a[1])} color="var(--amber)" />
      </div>

      <div className="kicker">Every return, newest first</div>
      <div className="feed">
        {events.map((e, i) => {
          const name = pick(e, "delivery associate", "delivery associate name") || "Unknown";
          const impact = (pick(e, "impact dcr") || "").toUpperCase() === "Y";
          const note = pick(e, "additional information");
          const exempt = pick(e, "exemption reason") || "";
          const isExempt = exempt && !/no exemption/i.test(exempt) && exempt !== "--";
          return (
            <FeedItem
              key={i}
              name={name}
              driverId={pick(e, "transporter id") || ""}
              tag={rtsPlain(pick(e, "da selected rts code"))}
              tagClass={impact ? "bad" : "ok"}
              quote={
                isExempt
                  ? `Exempted (${exempt}) — no score impact`
                  : impact
                  ? `Counting against DCR${note ? ` · ${note}` : ""}`
                  : note || null
              }
              meta={pick(e, "tracking id")}
              when={(pick(e, "planned delivery date") || "").slice(0, 10)}
            />
          );
        })}
        {!events.length && <p className="muted">No RTS events recorded. 🎉</p>}
      </div>
    </Shell>
  );
}
