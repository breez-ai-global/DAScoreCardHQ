import EventsPage from "../../components/EventsPage";
import { loadData } from "../../lib/data";

export const dynamic = "force-static";

export default function FeedbackPage() {
  const data = loadData();
  return (
    <EventsPage
      title="Customer Delivery Negative Feedback"
      sub={`${data.events.feedback.length} events across loaded weeks`}
      rows={data.events.feedback}
    />
  );
}
