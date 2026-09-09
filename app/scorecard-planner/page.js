import PlannerApp from "./PlannerApp";

export const dynamic = "force-static";

export const metadata = {
  title: "Scorecard Planner — Breez Global Logistics",
  description:
    "Upload any Amazon DSP weekly scorecard and see exactly what drives the Overall Standing.",
};

export default function ScorecardPlannerPage() {
  return <PlannerApp />;
}
