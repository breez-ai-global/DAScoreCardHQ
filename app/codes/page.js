import Shell from "../../components/Shell";

export const dynamic = "force-static";

const CODES = [
  ["DCR", "Delivery Completion Rate", "Out of all the packages put on the van, what % actually got delivered? 100% is perfect. Packages brought back to the station (RTS) lower this — unless the reason is exempted (like a damaged box)."],
  ["RTS", "Return To Station", "A package that came back undelivered. Each one has a reason code the driver picked (business closed, dog, can't find address, etc.). Some reasons are excused; others count against DCR."],
  ["DA Controllable", "Driver-Controllable Return", "A returned package where Amazon says the driver could have prevented it (e.g., didn't call or text the customer first). These are the returns that hurt the score."],
  ["DPMO", "Defects Per Million Opportunities", "A fancy way to say 'mistake rate.' It scales mistakes as if the driver delivered one million packages, so drivers with different route sizes can be compared fairly. Lower = better. Example: 1 complaint in 350 packages ≈ 2,857 DPMO."],
  ["CDF", "Customer Delivery Feedback", "Negative feedback customers leave: 'never got my package,' 'wrong address,' 'ignored my instructions,' etc. Measured in DPMO. One unhappy customer on a small route can spike this number."],
  ["CED", "Customer Escalation Defect", "The serious stuff — complaints bad enough that they got escalated (rudeness, mishandling, big problems). Zero is the goal, and zero is normal."],
  ["POD", "Photo On Delivery", "When dropping a package, the driver takes a photo. POD measures what % of those photos passed Amazon's quality check (package visible, at the door, not blurry, no finger over the lens)."],
  ["SWC-POD", "Success With Compliance — Photo", "Same idea as POD, written as a decimal (1.00 = 100% of photos passed)."],
  ["DSB", "Delivery Success Behaviors", "Risky scan habits caught by the app: delivering more than 50 meters from the correct spot, using the wrong scan type, marking 'handed to customer' when nobody was there, etc. Measured in DPMO. Zero is the goal."],
  ["DNR", "Delivered Not Received", "A package marked 'delivered' that the customer says never showed up. Often theft or a bad drop spot — frequently disputable when the photo proves correct delivery."],
  ["PSB", "Pickup Success Behaviors", "Same idea as DSB but for pickups instead of deliveries. Most routes have none."],
  ["FICO", "Safe-Driving Score", "A driving score (from camera/telematics data) like a credit score for driving: 800+ is great. Blank means not enough trips were recorded for a score this week."],
  ["Speeding / Seatbelt / Distractions / Sign / Following Distance", "On-Road Safety Events", "Counted per trip by the in-van camera system: going over the limit, belt off while moving, phone/eyes-off-road, rolling stop signs, tailgating. Any number above 0.0 needs an immediate conversation."],
  ["Overall Standing", "Weekly Tier (Breez scale)", "Each driver's weekly grade, computed straight from their Overall Score on our own scale: Platinum 98+, Gold 90–97.9, Silver 80–89.9, Bronze 70–79.9, At Risk under 70. Amazon's official label is shown on hover when it's more generous than ours."],
  ["Overall Score", "Weekly Score out of 100", "The single blended number behind the tier (safety + quality + customer feedback, weighted). 98+ is a truly clean week; anything under 70 needs intervention now."],
  ["Exemption", "Excused Return", "When a return reason is accepted (damaged box, customer rescheduled, business-hours issue), the return is 'exempted' and doesn't count against DCR. 'No Exemption Applied' = it IS counting against you — that's the first place to look for disputes."],
  ["OTP", "One-Time Password", "Some deliveries require a code from the customer. 'OTP Not Available' means the customer couldn't provide it — an excused return."],
  ["Tracking ID (TBA…)", "Package ID", "The unique number for one specific package. Use it when filing a dispute so Amazon knows exactly which delivery you mean."],
  ["Transporter ID", "Driver ID", "Amazon's internal ID for each driver (starts with 'A…'). Names can repeat; IDs never do."],
];

export default function CodesPage() {
  return (
    <Shell>
      <h1 className="page-title">📖 Every code on the scorecard, translated</h1>
      <p className="page-sub">If a 15-year-old can read this page, they can read the whole dashboard.</p>
      <div className="codes-grid">
        {CODES.map(([code, name, desc]) => (
          <div className="panel code-card" key={code}>
            <div>
              <span className="flag-chip">{code}</span> <b style={{ marginLeft: 6 }}>{name}</b>
            </div>
            <p style={{ lineHeight: 1.55, fontSize: 13.5, color: "#c6cde0", marginBottom: 0 }}>{desc}</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}
