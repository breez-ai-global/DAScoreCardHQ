import EventsPage from "../../components/EventsPage";
import { loadData } from "../../lib/data";

export const dynamic = "force-static";

export default function RtsPage() {
  const data = loadData();
  return (
    <EventsPage
      title="Return to Station"
      sub={`${data.events.rts.length} events across loaded weeks`}
      rows={data.events.rts}
    />
  );
}
