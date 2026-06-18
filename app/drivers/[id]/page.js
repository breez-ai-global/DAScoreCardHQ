import Shell from "../../../components/Shell";
import DeepDive from "../../../components/DeepDive";
import {
  loadData,
  allWeeks,
  driversForWeek,
  rankScore,
  pick,
  metricTier,
} from "../../../lib/data";
import {
  listScopes,
  driversForScope,
  driverForScope,
  driverScopedEvents,
  weekWindow,
} from "../../../lib/aggregate";
import { driverInsights } from "../../../lib/insights";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  const data = loadData();
  const ids = new Set();
  for (const wk of allWeeks(data)) for (const d of driversForWeek(wk, data)) ids.add(d.id);
  return [...ids].map((id) => ({ id: encodeURIComponent(id) }));
}

function slimRec(d) {
  if (!d) return null;
  return {
    id: d.id, name: d.name, tierText: d.tierText, overall: d.overall,
    delivered: d.delivered, dcr: d.dcr, pod: d.pod, cdf: d.cdf, dsb: d.dsb,
    rtsCount: d.rtsCount, weeksActive: d.weeksActive || 1,
  };
}

function dailyForScope(id, name, scope, data) {
  const win = scope === "all" ? null : weekWindow(scope);
  return Object.keys(data.daily)
    .sort()
    .map((day) => {
      if (win && (day < win.start || day > win.end)) return null;
      const row = (data.daily[day] || []).find((r) => {
        const rid = pick(r, "transporter id") || "";
        const rname = pick(r, "delivery associate", "name") || "";
        return rid === id || rname.toLowerCase() === (name || "").toLowerCase();
      });
      return row
        ? {
            day,
            delivered: pick(row, "packages delivered", "delivered") || "—",
            dcr: pick(row, "dcr") || "—",
            pod: pick(row, "pod") || "—",
            cdf: pick(row, "cdf dpmo", "cdf") || "—",
            dsb: pick(row, "dsb") || "—",
          }
        : null;
    })
    .filter(Boolean);
}

export default function DriverDetail({ params }) {
  const id = decodeURIComponent(params.id);
  const data = loadData();
  const scopes = listScopes(data);

  const roster = driversForScope("all", data)
    .sort((a, b) => rankScore(b) - rankScore(a))
    .map((d) => ({ id: d.id, name: d.name, tierText: d.tierText, overall: d.overall }));

  // weekly history (for the table) + metric tier classes per week
  const weeks = allWeeks(data);
  const history = weeks
    .map((wk) => driversForWeek(wk, data).find((d) => d.id === id))
    .filter(Boolean)
    .map((h) => ({ week: h.week, overall: h.overall, delivered: h.delivered, dcr: h.dcr, dsb: h.dsb, pod: h.pod, cdf: h.cdf }));
  const metricTierMap = { dcr: {}, pod: {}, cdf: {} };
  for (const h of history) {
    metricTierMap.dcr[h.week] = metricTier(h.dcr, "dcr")[1];
    metricTierMap.pod[h.week] = metricTier(h.pod, "pod")[1];
    metricTierMap.cdf[h.week] = metricTier(h.cdf, "cdf")[1];
  }

  const byScope = {};
  for (const s of scopes) {
    const rec = driverForScope(id, s, data);
    if (!rec) { byScope[s] = { rec: null }; continue; }
    const ev = driverScopedEvents(id, rec.name, s, data);
    const ins = driverInsights(rec, data, ev);
    byScope[s] = {
      rec: slimRec(rec),
      severe: ins.severe,
      improve: ins.improve,
      grow: ins.grow,
      well: ins.well,
      complaints: ev.feedback.length,
      dailyRows: dailyForScope(id, rec.name, s, data),
    };
  }

  if (!history.length && !byScope.all?.rec) {
    return (
      <Shell>
        <h1 className="page-title">Driver not found</h1>
      </Shell>
    );
  }

  return (
    <Shell>
      <DeepDive id={id} roster={roster} byScope={byScope} history={history} metricTierMap={metricTierMap} />
    </Shell>
  );
}
