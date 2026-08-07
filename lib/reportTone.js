// Manager-voice summaries. Tone tracks the report type across the full ladder:
// excellent + positive are warm recognition; coaching is growth-framed; the four
// warning tiers (warning1 → warning2 → pretermination → final) escalate from a
// first firm-but-fair notice to a grave last-chance document. Every tier carries
// a Success Plan.

export const REPORT_TYPES = [
  { value: "excellent", label: "Excellent Work" },
  { value: "positive", label: "Positive Reinforcement" },
  { value: "coaching", label: "Coaching Conversation" },
  { value: "warning1", label: "Formal Warning 1" },
  { value: "warning2", label: "Formal Warning 2" },
  { value: "pretermination", label: "Formal Warning — Pre-Termination" },
  { value: "final", label: "Final Warning" },
];

export const WARNING_TYPES = ["warning1", "warning2", "pretermination", "final"];
export const POSITIVE_TYPES = ["excellent", "positive"];

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

function strengthClause(m) {
  const s = [];
  if ((m.delivered || 0) >= 300) s.push(`handled real volume (${m.delivered.toLocaleString()} packages)`);
  if (m.dcr !== null && m.dcr >= 99) s.push(`kept completion strong at ${m.dcr}%`);
  if (m.pod !== null && m.pod >= 98) s.push(`kept delivery photos clean at ${m.pod}%`);
  if (m.feedback === 0) s.push(`took zero negative customer feedback`);
  return s;
}

export function makeManagerSummary(severity, driver) {
  const f = firstName(driver?.name);
  const m = driver?.metrics || {};
  const issues = issueClause(m);
  const week = driver?.week || "this period";
  const strengths = strengthClause(m);
  const strong = strengths.length ? strengths.join(", ") : "showed up and did the work";

  if (severity === "excellent") {
    return [
      `${f}, I want to put this in writing because it deserves to be on the record: your work this period was excellent. You ${strong}. That's not luck — that's craft, and I see it.`,
      `This is the standard we point to when we talk about what great looks like on this team. Customers get treated right, the scorecard stays clean, and dispatch never has to worry about your route. You make the whole operation better.`,
      `Keep doing exactly what you're doing — and the plan below is about stretching from great to elite: sharing what works with newer DAs and chasing a perfect week. Thank you. Recognition like this counts, and it follows you.`,
    ].join("\n\n");
  }

  if (severity === "positive") {
    return [
      `${f}, this is a quick but real thank-you. You ${strong} this period, and I noticed. The little habits — following delivery instructions, clean photos, good communication — are adding up, and it shows in your numbers.`,
      `I want you to feel the momentum here. You're trending in the right direction, and consistency is what turns a good stretch into a great reputation. That's within reach for you.`,
      `The plan below is just about locking in the habits that are working and taking one small step further. Keep it up — I'm glad you're on this team.`,
    ].join("\n\n");
  }

  if (severity === "coaching") {
    return [
      `${f}, first — the work you're putting in matters${strengths.length ? `, and it shows: this period you ${strong}` : ""}. This conversation isn't a punishment; it's us investing in you.`,
      issues.length
        ? `That said, ${week} surfaced a few things we need to clean up together: ${issues.join("; ")}. None of these are beyond fixing, and most come down to small habits — slowing down at the door, double-checking the unit number, calling before returning a package.`
        : `This is a general check-in on standards and habits so small things never become big things.`,
      `Let's commit to the expectations and plan below for the next two weeks. If anything on the route makes them hard to hit — bad map pins, overloaded routes, access issues — tell dispatch in the moment so we can fix the root cause, not grade you for it.`,
    ].join("\n\n");
  }

  if (severity === "warning1") {
    return [
      `${f}, this is a formal warning — the first one — and I want to be straight with you about why. During ${week} we recorded ${issues.length ? issues.join("; ") : "performance below the standard we committed to"}. Individually these may feel small; together they put your scorecard, and your route assignments, at risk.`,
      `I also want to be fair: ${strengths.length ? `you ${strong}, and ` : ""}not every event is fully in your control. Anything you believe was a bad pin, theft, or an app issue, flag it to us immediately — we dispute those with Amazon every week.`,
      `This is step one of a documented process, and it stops here if we act now. The expectations and success plan below are written down so we're both clear, and we'll review progress on the date listed. Meet them and this stays a bump in the road. I believe you can — that's why we're talking now instead of later.`,
    ].join("\n\n");
  }

  if (severity === "warning2") {
    return [
      `${f}, this is a second formal warning, which means we've been here before. During ${week} we again recorded ${issues.length ? issues.join("; ") : "performance below the documented standard"}, after we'd already talked about the same kind of thing.`,
      `I'm not writing this to pile on. ${strengths.length ? `You ${strong}, and ` : ""}I still believe in your ability to turn this around — but I need you to feel that the pattern is now serious, not occasional. Keep flagging anything you believe is disputable; we'll fight those for you.`,
      `The success plan below is specific and time-bound, and we'll support you through it. Be clear-eyed with me though: if we don't see the change by the review date, the next step is a pre-termination warning. Let's not get there. Let's fix it here.`,
    ].join("\n\n");
  }

  if (severity === "pretermination") {
    return [
      `${f}, I need you to read this carefully: this is a pre-termination formal warning. Over ${week} we recorded ${issues.length ? issues.join("; ") : "continued performance below the documented standard"}, following prior warnings on the same issues.`,
      `This isn't about who you are or how hard you try — it's about a documented pattern that has now reached the step just before a final warning. The success plan below is specific, achievable, and fully supported: ride-alongs, photo retraining, daily dispatch check-ins. I'm asking you to use every bit of it.`,
      `I'll be direct because you deserve honesty: if the plan isn't met by the review date, the next document is a final warning, and after that, termination of the delivery associate agreement. I would much rather write your comeback. That starts with your very next route.`,
    ].join("\n\n");
  }

  // final
  return [
    `${f}, this document is a final warning, and I need you to read it as exactly that. Over ${week} we recorded ${issues.length ? issues.join("; ") : "continued performance below the documented standard"}, following previous warnings on the same issues.`,
    `This isn't about effort or who you are — it's about a documented pattern that now puts your position at risk. The success plan below is specific, time-bound, and achievable, and we will support you through every step of it: ride-alongs, photo retraining, dispatch check-ins. Use us.`,
    `Be equally clear on the other side of it: if the plan's requirements aren't met by the review date, the next step is termination of the delivery associate agreement. We would much rather write your turnaround story. That outcome is in your hands, starting with your next route.`,
  ].join("\n\n");
}

// Type-appropriate default Expectations + Success Plan text. Recognition tiers
// get growth-framed plans; warnings get corrective plans that escalate in rigor.
export function defaultsFor(severity) {
  if (POSITIVE_TYPES.includes(severity)) {
    return {
      expectations:
        "Keep following delivery instructions on every stop.\nKeep POD photos clean (≥ 98%).\nKeep communicating with dispatch on any route issues.",
      plan:
        "Weeks 1–2: Keep doing what's working; share a tip or two with a newer DA.\nWeeks 3–4: Take one stretch step — mentor a teammate or target a perfect week (zero negative feedback, POD ≥ 99%).",
    };
  }
  if (severity === "coaching") {
    return {
      expectations:
        "Follow delivery instructions on every stop.\nTake clear POD photos at the correct drop location.\nContact dispatch before marking any package RTS.",
      plan:
        "Week 1: Ride-along review of delivery photos with dispatch.\nWeek 2: Daily check-in on CDF and RTS before route end.\nWeeks 3–4: Maintain zero negative feedback and POD ≥ 98%.",
    };
  }
  if (severity === "warning1") {
    return {
      expectations:
        "Follow delivery instructions on every stop, every day.\nPOD photos clear and at the correct location — target ≥ 98%.\nCall AND text before returning any package to station.",
      plan:
        "Week 1: Photo + delivery-instruction refresher with dispatch; flag any disputable events same-day.\nWeek 2: Daily end-of-route check on CDF, POD, and RTS.\nReview on the date below — expectations met keeps this at Warning 1.",
    };
  }
  if (severity === "warning2") {
    return {
      expectations:
        "Zero avoidable negative customer feedback.\nPOD ≥ 98% with correct drop locations.\nNo driver-controllable returns without prior dispatch contact.",
      plan:
        "Week 1: Ride-along with a lead; review every prior event together.\nWeek 2: Daily photo audit + dispatch check-in before route end.\nWeeks 3–4: Sustain the standard. Review on the date below — this is the step before a pre-termination warning.",
    };
  }
  if (severity === "pretermination") {
    return {
      expectations:
        "Meet the documented standard on every metric, every route.\nZero avoidable negative feedback; POD ≥ 98%; no uncontacted controllable RTS.\nImmediate dispatch communication on any obstacle.",
      plan:
        "Daily: End-of-route review of feedback, POD, and RTS with a lead.\nWeekly: Ride-along and photo retraining until the standard holds.\nFull review on the date below. This is the final step before a final warning — meeting the plan stops the escalation.",
    };
  }
  // final
  return {
    expectations:
      "Meet the documented standard on every metric, without exception.\nZero avoidable negative feedback; POD ≥ 98%; no uncontacted controllable RTS.\nImmediate dispatch communication on any obstacle.",
    plan:
      "Daily: End-of-route review with a lead on feedback, POD, and RTS.\nWeekly: Ride-along + photo retraining; document every disputed event.\nFull review on the date below. Not meeting the plan leads to termination of the delivery associate agreement.",
  };
}
