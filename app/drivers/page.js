import Shell from "../../components/Shell";
import DriversView from "../../components/DriversView";
import { loadData, rankScore } from "../../lib/data";
import { listScopes, driversForScope } from "../../lib/aggregate";

export const dynamic = "force-static";

function slim(d) {
  return {
    id: d.id,
    name: d.name,
    tierText: d.tierText,
    overall: d.overall,
    delivered: d.delivered,
    dcr: d.dcr,
    pod: d.pod,
    feedbackCount: d.feedbackCount,
    concessionCount: d.concessionCount,
    rtsEventCount: d.rtsEventCount,
    weeksActive: d.weeksActive || 1,
  };
}

export default function DriversPage() {
  const data = loadData();
  const byScope = {};
  for (const s of listScopes(data)) {
    byScope[s] = driversForScope(s, data)
      .sort((a, b) => rankScore(b) - rankScore(a))
      .map(slim);
  }
  return (
    <Shell>
      <DriversView byScope={byScope} />
    </Shell>
  );
}
