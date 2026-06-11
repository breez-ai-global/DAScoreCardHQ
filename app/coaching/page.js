import { Suspense } from "react";
import Shell from "../../components/Shell";
import CoachingBuilder from "../../components/CoachingBuilder";
import { loadData, latestWeek, driversForWeek, driverEvents, pick } from "../../lib/data";

export const dynamic = "force-static";

export default function CoachingPage() {
  const data = loadData();
  const week = latestWeek(data);
  const drivers = week ? driversForWeek(week, data) : [];

  const options = drivers.map((d) => {
    const ev = driverEvents(d.id, d.name, data);
    return {
      id: d.id,
      name: d.name,
      week,
      metrics: {
        overall: d.overall,
        delivered: d.delivered,
        dcr: d.dcr,
        pod: d.pod,
        cdf: d.cdf,
        feedback: ev.feedback.length,
        concessions: ev.concessions.length,
        rts: ev.rts.length,
      },
      issues: [
        ...ev.feedback.map((e) => ({
          type: "Negative Feedback",
          date: pick(e, "delivery date", "date") || "",
          detail:
            pick(e, "feedback details") ||
            Object.entries(e)
              .filter(([k, v]) => v === "●" || v === "1" || v === "Yes")
              .map(([k]) => k)
              .filter((k) => /da |delivered|received|wrong/i.test(k))
              .join(", ") ||
            "Negative customer feedback",
        })),
        ...ev.concessions.map((e) => ({
          type: "Concession",
          date: pick(e, "delivery date", "concession date", "date") || "",
          detail: pick(e, "delivery type") ? `${pick(e, "delivery type")} delivery concession` : "Concession",
        })),
        ...ev.rts.map((e) => ({
          type: "RTS",
          date: pick(e, "planned delivery date", "date") || "",
          detail: pick(e, "da selected rts code") || "Package returned to station",
        })),
      ],
    };
  });

  return (
    <Shell>
      <h1 className="page-title">Coaching Reports</h1>
      <p className="page-sub">
        Build a coaching report, warning, or success plan — then share it as a link or print it.
      </p>
      <Suspense>
        <CoachingBuilder drivers={options} />
      </Suspense>
    </Shell>
  );
}
