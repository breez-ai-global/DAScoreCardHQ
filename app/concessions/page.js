import EventsPage from "../../components/EventsPage";
import { loadData } from "../../lib/data";

export const dynamic = "force-static";

export default function ConcessionsPage() {
  const data = loadData();
  return (
    <EventsPage
      title="Concessions"
      sub={`${data.events.concessions.length} events across loaded weeks`}
      rows={data.events.concessions}
    />
  );
}
