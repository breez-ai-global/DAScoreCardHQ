// One-line tooltip definitions for every code on the scorecard.
export const TIPS = {
  DCR: "Delivery Completion Rate — % of packages on the van that actually got delivered. Returns without an exemption lower it.",
  RTS: "Return To Station — a package that came back undelivered. Some reasons are excused, others count against DCR.",
  POD: "Photo On Delivery — % of delivery photos that passed Amazon's quality check (clear, at the door, package visible).",
  CDF: "Customer Delivery Feedback — negative customer comments, measured in DPMO (rate per million deliveries). Lower is better.",
  CED: "Customer Escalation Defect — complaints serious enough to be escalated. Zero is the goal.",
  DSB: "Delivery Success Behaviors — risky scan habits (scanning >50m away, wrong scan type). Measured in DPMO; zero is the goal.",
  DNR: "Delivered Not Received — marked delivered but the customer says it never arrived. Often theft; frequently disputable.",
  DPMO: "Defects Per Million Opportunities — a mistake rate scaled to one million packages so route sizes compare fairly.",
  PSB: "Pickup Success Behaviors — like DSB, but for pickups. Most routes have none.",
  FICO: "Safe-driving score from camera/telematics — like a credit score for driving. 800+ is great.",
  Score: "Weekly blended score out of 100 (safety + quality + customer feedback). 85+ ≈ Platinum territory, below 70 = problem.",
  Tier: "Amazon's weekly grade (Platinum/Gold/Silver/Bronze) from the Overall Score. We flag anyone under 70 as At Risk regardless.",
  "At Risk": "This driver's overall score is under 70 — whatever Amazon's tier label says, this week needs intervention.",
  Exemption: "An excused return (damaged box, rescheduled, business hours). 'No exemption applied' means it IS hurting DCR.",
  Completion: "Delivery Completion Rate — % of dispatched packages actually delivered. Below 99% drags the score.",
  Photos: "Photo On Delivery pass rate. Below 98% starts costing points and makes complaints hard to dispute.",
  Complaints: "Negative customer feedback events (CDF) tied to this driver's deliveries.",
  "Scan Flags": "DSB events — scans far from the drop point or with the wrong scan type. Looks like fake deliveries to Amazon.",
  "Urgent Items": "High-priority dispute flags — events actively hurting a metric right now.",
  Concession: "A refund Amazon issued for a delivery problem, traced back to a specific package.",
  "Controllable Returns": "Returns Amazon says the driver could have prevented (e.g., no call/text attempt). These hurt the score.",
  Delivered: "Packages successfully delivered this period.",
};

export function tip(key) {
  return TIPS[key] || null;
}
