import Shell from "../components/Shell";
import OverviewView from "../components/OverviewView";
import { loadData } from "../lib/data";
import { listScopes, buildOverview } from "../lib/aggregate";

export const dynamic = "force-static";

export default function Dashboard() {
  const data = loadData();
  const scopes = listScopes(data);
  const byScope = {};
  for (const s of scopes) byScope[s] = buildOverview(s, data);

  return (
    <Shell>
      <OverviewView byScope={byScope} generatedAt={data.generatedAt} />
    </Shell>
  );
}
