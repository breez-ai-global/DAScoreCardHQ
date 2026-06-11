// Manager-voice summaries. Tone tracks the report type: coaching is warm and
// growth-framed, warning is direct with clear stakes, final is formal and grave.

function firstName(n) {
  return (n || "").split(/\s+/)[0] || "this driver";
}

function issueClause(m) {
  const parts = [];
  if (m.feedback) parts.push(`${m.feedback} negative customer feedback event${m.feedback > 1 ? "s" : ""}`);
  if (m.concessions) parts.push(`${m.concessions} concession${m.concessions > 1 ? "s" : ""}`);
  if (m.rts) parts.push(`${m.rts} package${m.rts > 1 ? "s" : ""} returned to station`);
  if (m.pod !== null && m.pod !== undefined && m.pod < 97) parts.push(`a photo-on-delivery rate of ${m.pod}%`);
  if (m.dcr !== null && m.dcr !== undefined && m.dcr < 99) parts.push(`a completion rate of ${m.dcr}%`);
  return parts;
}

export function makeManagerSummary(severity, driver) {
  const f = firstName(driver?.name);
  const m = driver?.metrics || {};
  const issues = issueClause(m);
  const week = driver?.week || "this period";
  const strengths = [];
  if ((m.delivered || 0) >= 300) strengths.push(`handled real volume (${m.delivered.toLocaleString()} packages)`);
  if (m.dcr !== null && m.dcr >= 99) strengths.push(`kept completion strong at ${m.dcr}%`);
  if (m.pod !== null && m.pod >= 98) strengths.push(`kept delivery photos clean at ${m.pod}%`);

  if (severity === "coaching") {
    return [
      `${f}, first — the work you're putting in matters${strengths.length ? `, and it shows: this week you ${strengths.join(" and ")}` : ""}. This conversation isn't a punishment; it's us investing in you.`,
      issues.length
        ? `That said, ${week} surfaced a few things we need to clean up together: ${issues.join("; ")}. None of these are beyond fixing, and most come down to small habits — slowing down at the door, double-checking the unit number, calling before returning a package.`
        : `This is a general check-in on standards and habits so small things never become big things.`,
      `Let's commit to the expectations below for the next two weeks. If anything on the route makes them hard to hit — bad map pins, overloaded routes, access issues — tell dispatch in the moment so we can fix the root cause, not grade you for it.`,
    ].join("\n\n");
  }

  if (severity === "warning") {
    return [
      `${f}, this is a formal warning, and I want to be straight with you about why. During ${week} we recorded ${issues.length ? issues.join("; ") : "performance below the standard we committed to"}. Individually these may feel small; together they put your scorecard — and route assignments — at risk.`,
      `I also want to be fair: ${strengths.length ? `you ${strengths.join(" and ")}, and ` : ""}we know not every event is fully in your control. Anything you believe was a bad pin, theft, or an app issue, flag it to us immediately — we dispute those with Amazon every week.`,
      `What's not negotiable is the pattern. The expectations below are written down so we're both clear, and we'll review progress on the date listed. Meet them and this stays a bump in the road. I believe you can — that's why we're having this conversation now instead of later.`,
    ].join("\n\n");
  }

  // final
  return [
    `${f}, this document is a final warning, and I need you to read it as exactly that. Over ${week} we recorded ${issues.length ? issues.join("; ") : "continued performance below the documented standard"}, following previous coaching on the same issues.`,
    `This isn't about effort or who you are — it's about a documented pattern that now puts your position at risk. The success plan below is specific, time-bound, and achievable, and we will support you through every step of it: ride-alongs, photo retraining, dispatch check-ins. Use us.`,
    `Be equally clear on the other side of it: if the plan's requirements aren't met by the review date, the next step is termination of the delivery associate agreement. We would much rather write your turnaround story. That outcome is in your hands, starting with your next route.`,
  ].join("\n\n");
}
