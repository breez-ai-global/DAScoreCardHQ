import Shell from "../../components/Shell";
import DisputeCenter from "../../components/DisputeCenter";
import { loadData } from "../../lib/data";
import { disputeFlags } from "../../lib/insights";

export const dynamic = "force-static";

export default function DisputesPage() {
  const flags = disputeFlags(loadData());
  return (
    <Shell>
      <h1 className="page-title">Dispute Center <span className="pill risk" style={{ fontSize: 14, verticalAlign: "middle" }}>{flags.length}</span></h1>
      <p className="page-sub">Auto-flagged items that may be winnable disputes or qualify for exemptions.</p>
      <DisputeCenter flags={flags} />
    </Shell>
  );
}
