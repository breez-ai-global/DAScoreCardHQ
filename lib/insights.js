// Insight engine: plain-English narratives, severity grading, dispute flags.
import { loadData, latestWeek, driversForWeek, driverEvents, rankScore, pick, num } from "./data";

// ---------- translations ----------
export const RTS_PLAIN = {
  "BUSINESS CLOSED": "Business was closed",
  "UNSAFE DUE TO DOG": "Dog made the stop unsafe",
  "OBJECT MISSING": "Locker/mailroom object missing",
  "INACCESSIBLE DELIVERY LOCATION": "Couldn't access the location",
  "ADDRESS NOT FOUND": "Couldn't find the address",
  "UNABLE TO LOCATE": "Couldn't locate the address",
  "OUT OF DRIVING TIME": "Ran out of legal driving time",
  "NO SECURE LOCATION": "No safe place to leave it",
  "CUSTOMER UNAVAILABLE": "Customer wasn't available",
  "CUSTOMER RESCHEDULED": "Customer rescheduled",
  "OTP NOT AVAILABLE": "Customer couldn't provide OTP",
  "BAD WEATHER": "Bad weather",
  "DAMAGED": "Package was damaged",
};

export function rtsPlain(code) {
  return RTS_PLAIN[(code || "").toUpperCase().trim()] || (code || "Returned to station");
}

export const COMPLAINT_COLS = [
  ["DA Mishandled Package", "Package was mishandled"],
  ["DA was Unprofessional", "Driver was unprofessional"],
  ["DA did not follow my delivery instructions", "Didn't follow delivery instructions"],
  ["Delivered to Wrong Address", "Delivered to the wrong address"],
  ["Never Received Delivery", "Customer says it never arrived"],
  ["Received Wrong Item", "Customer received the wrong item"],
];

export function complaintType(e) {
  for (const [col, label] of COMPLAINT_COLS) {
    if (num(pick(e, col)) === 1 || pick(e, col) === "●") return label;
  }
  return "Negative feedback";
}

// ---------- score helpers ----------
export function scoreBand(s) {
  if (s === null || s === undefined) return ["nodata", "var(--dusk)"];
  if (s >= 85) return ["safe", "var(--green)"];
  if (s >= 70) return ["watch", "var(--amber)"];
  return ["risk", "var(--red)"];
}

// ---------- overview / KPIs ----------
export function overview(data = loadData()) {
  const week = latestWeek(data);
  const drivers = week ? driversForWeek(week, data) : [];
  const active = drivers.filter((d) => (d.delivered || 0) > 0 || d.overall !== null);
  const ranked = [...active].sort((a, b) => rankScore(b) - rankScore(a));

  const scored = ranked.filter((d) => d.overall !== null);
  const avgScore = scored.length
    ? scored.reduce((s, d) => s + d.overall, 0) / scored.length
    : null;
  const platinum = ranked.filter((d) => /platinum/i.test(d.tierText || "")).length;

  const delivered = ranked.reduce((s, d) => s + (d.delivered || 0), 0);

  // controllable returns from DCR detail
  const dcrRows = data.details?.dcr?.[week] || [];
  const controllable = dcrRows.reduce(
    (s, r) => s + (num(pick(r, "packages returned to station - da controllable")) || 0),
    0
  );

  // tier mix
  const mix = { Platinum: 0, Gold: 0, Silver: 0, Bronze: 0, Unrated: 0 };
  for (const d of ranked) {
    const t = (d.tierText || "").toLowerCase();
    if (t.includes("platinum")) mix.Platinum++;
    else if (t.includes("gold")) mix.Gold++;
    else if (t.includes("silver")) mix.Silver++;
    else if (t.includes("bronze")) mix.Bronze++;
    else mix.Unrated++;
  }

  // complaints by type
  const complaints = {};
  for (const e of data.events.feedback) {
    const t = complaintType(e);
    complaints[t] = (complaints[t] || 0) + 1;
  }

  // RTS by plain reason
  const rtsReasons = {};
  for (const e of data.events.rts) {
    const t = rtsPlain(pick(e, "da selected rts code"));
    rtsReasons[t] = (rtsReasons[t] || 0) + 1;
  }

  const disputes = disputeFlags(data);
  const attention = ranked.filter(
    (d) =>
      (d.overall !== null && d.overall < 85) ||
      d.feedbackCount > 0 ||
      d.concessionCount > 0
  );

  return {
    week,
    ranked,
    avgScore,
    platinum,
    total: ranked.length,
    delivered,
    complaintsTotal: data.events.feedback.length,
    controllable,
    disputeCount: disputes.length,
    disputes,
    mix,
    complaints,
    rtsReasons,
    attention,
    top3: ranked.slice(0, 3),
  };
}

// ---------- dispute flag engine ----------
export function disputeFlags(data = loadData()) {
  const flags = [];

  const hadContactGap = (e) =>
    /no contact attempted/i.test(pick(e, "additional information") || "");

  for (const e of data.events.rts) {
    const code = (pick(e, "da selected rts code") || "").toUpperCase().trim();
    const exempt = pick(e, "exemption reason") || "";
    const exempted = exempt && !/no exemption/i.test(exempt) && exempt !== "--";
    const impact = (pick(e, "impact dcr") || "").toUpperCase() === "Y";
    if (!impact || exempted) continue;

    const base = {
      driver: pick(e, "delivery associate", "delivery associate name") || "Unknown",
      driverId: pick(e, "transporter id") || "",
      flag: "Return (RTS) hurting DCR",
      detail: rtsPlain(code),
      ref: pick(e, "tracking id") || "",
      date: pick(e, "planned delivery date", "date") || "",
    };

    if (["INACCESSIBLE DELIVERY LOCATION", "ADDRESS NOT FOUND", "UNABLE TO LOCATE", "UNABLE TO ACCESS"].includes(code)) {
      flags.push({
        ...base,
        priority: "High",
        why:
          'Return is counting against DCR with no exemption applied.' +
          (hadContactGap(e)
            ? ' Note says "No contact attempted" — that contact gap is why no exemption applied. Coach the driver, but verify the address actually exists/was reachable; bad map pins are disputable.'
            : " Verify the address actually exists/was reachable; bad map pins are disputable."),
      });
    } else if (code === "BUSINESS CLOSED") {
      flags.push({
        ...base,
        priority: "Medium",
        why: "Return is counting against DCR with no exemption applied. Business-closed returns often qualify for a business-hours exemption — check if the stop was routed outside the business's posted hours.",
      });
    } else if (code === "OBJECT MISSING" || code.includes("LOCKER")) {
      flags.push({
        ...base,
        priority: "Medium",
        why: "Return is counting against DCR with no exemption applied. Missing locker/mailroom situations are often facility issues — exemption may apply.",
      });
    } else if (code === "OUT OF DRIVING TIME") {
      flags.push({
        ...base,
        priority: "Look into",
        why: "Return is counting against DCR with no exemption applied. Out-of-time returns are usually a routing/dispatch issue, not the driver — worth raising if routes are consistently overloaded.",
      });
    } else if (code === "UNSAFE DUE TO DOG" || code === "NO SECURE LOCATION") {
      flags.push({
        ...base,
        priority: "Medium",
        why: "Return is counting against DCR with no exemption applied. Safety-related returns (dog, no secure location) are frequently exemptable when documented — check the driver's notes/photos.",
      });
    } else {
      flags.push({
        ...base,
        priority: "Look into",
        why: "Return is counting against DCR with no exemption applied. Review the reason code and any notes to see if an exemption fits.",
      });
    }
  }

  for (const e of data.events.feedback) {
    const t = complaintType(e);
    const base = {
      driver: pick(e, "delivery associate name") || pick(e, "delivery associate") || "Unknown",
      driverId: pick(e, "delivery associate") || "",
      ref: pick(e, "tracking id") || "",
      date: pick(e, "delivery date", "date") || "",
    };
    if (t === "Customer says it never arrived") {
      flags.push({
        ...base,
        priority: "Look into",
        flag: "“Never received” complaint",
        detail: pick(e, "feedback details") || "Customer says it never arrived",
        why: "If the delivery photo shows a correct drop at the right door, this is often porch theft — a prime dispute candidate, not driver error. Pull the POD photo for this tracking ID.",
      });
    } else if (t === "Delivered to the wrong address") {
      flags.push({
        ...base,
        priority: "Look into",
        flag: "Wrong-address complaint",
        detail: pick(e, "feedback details") || "Delivered to wrong address",
        why: 'Check whether the map pin matched the actual unit. Apartment complexes with bad geocoding cause "wrong unit" complaints that aren’t driver error — disputable with GPS evidence. If the pin was right, coach on unit-number verification.',
      });
    }
  }

  for (const e of data.events.concessions) {
    const far = pick(e, "delivered > 50 m");
    const scanA = pick(e, "incorrect scan usage - attended delivery");
    const scanU = pick(e, "incorrect scan usage - unattended delivery");
    const has = (v) => v === "●" || num(v) === 1;
    if (has(far)) {
      flags.push({
        priority: "Medium",
        driver: pick(e, "delivery associate name") || "Unknown",
        driverId: pick(e, "delivery associate") || "",
        flag: "Scan >50m from drop point",
        detail: "Delivery scan registered over 50 meters away",
        ref: pick(e, "tracking id") || "",
        date: pick(e, "delivery date", "concession date") || "",
        why: "Large complexes, garages, and tall buildings cause GPS drift. If the photos show correct deliveries, dispute the DSB events as location-accuracy errors. If not, coach: scan AT the door, not back at the van.",
      });
    }
    if (has(scanA) || has(scanU)) {
      flags.push({
        priority: "Medium",
        driver: pick(e, "delivery associate name") || "Unknown",
        driverId: pick(e, "delivery associate") || "",
        flag: "Incorrect scan usage",
        detail: has(scanA) ? "Wrong scan type on an attended delivery" : "Wrong scan type on an unattended delivery",
        ref: pick(e, "tracking id") || "",
        date: pick(e, "delivery date", "concession date") || "",
        why: "Wrong scan types look like fake deliveries to Amazon. Usually a training fix; occasionally app glitches mis-record the scan — ask the driver what happened before assuming fault.",
      });
    }
  }

  const order = { High: 0, Medium: 1, "Look into": 2 };
  flags.sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));
  return flags.map((f, i) => ({ ...f, id: `${f.ref || "x"}-${f.flag}-${i}` }));
}

// ---------- per-driver severity sections ----------
export function driverInsights(d, data = loadData()) {
  const ev = driverEvents(d.id, d.name, data);
  const severe = [];
  const improve = [];
  const grow = [];
  const well = [];

  if (d.pod !== null && d.pod < 90) {
    severe.push({
      title: `Only ${d.pod}% of delivery photos passed quality check.`,
      note: 'Bad/missing photos make "never received" complaints impossible to defend and tank the POD score. Retrain: step back, whole package + door in frame, no blur.',
    });
  } else if (d.pod !== null && d.pod < 98) {
    improve.push({
      title: `Photo quality (POD) at ${d.pod}% — below the 98% bar.`,
      note: "A handful of rejected photos. Quick refresher on framing usually fixes this.",
    });
  }

  const scanEvents = ev.concessions.filter((e) => {
    const has = (v) => v === "●" || num(v) === 1;
    return (
      has(pick(e, "delivered > 50 m")) ||
      has(pick(e, "incorrect scan usage - attended delivery")) ||
      has(pick(e, "incorrect scan usage - unattended delivery"))
    );
  });
  if (scanEvents.length) {
    severe.push({
      title: `${scanEvents.length} risky scan event(s)${d.dsb ? ` (DSB ${d.dsb.toLocaleString()} DPMO)` : ""}.`,
      note: "Scanning far from the pin or with the wrong type looks like fake deliveries to Amazon. If GPS drift in an apartment complex caused it, this is disputable — check the Dispute Center.",
      items: scanEvents.map((e) => ({
        label:
          (pick(e, "delivered > 50 m") === "●" || num(pick(e, "delivered > 50 m")) === 1)
            ? "Scanned more than 50 meters from the correct drop spot"
            : "Incorrect scan type used",
        ref: pick(e, "tracking id") || "",
        date: pick(e, "delivery date", "concession date") || "",
      })),
    });
  }

  if (ev.feedback.length) {
    severe.push({
      title: `${ev.feedback.length} customer complaint(s) this week:`,
      note: d.cdf ? `This puts the complaint rate (CDF) at ${d.cdf.toLocaleString()} DPMO.` : "",
      items: ev.feedback.map((e) => ({
        label: complaintType(e) + (pick(e, "feedback details") ? ` — “${pick(e, "feedback details")}”` : ""),
        ref: pick(e, "tracking id") || "",
        date: pick(e, "delivery date") || "",
      })),
    });
  }

  const controllableRts = ev.rts.filter(
    (e) => (pick(e, "impact dcr") || "").toUpperCase() === "Y"
  );
  if (d.dcr !== null && d.dcr < 99) {
    improve.push({
      title: `Completion rate at ${d.dcr}%${d.rtsCount ? ` — ${d.rtsCount} package(s) came back to the station.` : "."}`,
      note: "Below 99% drags the overall score noticeably.",
    });
  }
  if (controllableRts.length) {
    improve.push({
      title: `${controllableRts.length} driver-controllable return(s) counting against the score:`,
      note: '"No contact attempted" notes mean the fix is simple: always call AND text before returning a package. Some of these may qualify for exemptions — see the Dispute Center.',
      items: controllableRts.map((e) => ({
        label: rtsPlain(pick(e, "da selected rts code")),
        ref: pick(e, "tracking id") || "",
        date: pick(e, "planned delivery date") || "",
      })),
    });
  }

  const neverReceived = ev.feedback.filter((e) => complaintType(e) === "Customer says it never arrived").length;
  if (neverReceived) {
    grow.push({
      title: `${neverReceived} of the complaints are "never received" — if the delivery photo shows a correct drop, these are prime dispute candidates (often porch theft, not driver error).`,
    });
  }
  if (d.overall !== null && d.overall < 85) {
    grow.push({
      title: `Overall score ${d.overall} (${d.tierText || "—"}). Fixing the items above is the fastest path back to Platinum.`,
    });
  } else if (d.overall !== null && d.overall < 95 && d.overall >= 85) {
    grow.push({
      title: `Overall score ${d.overall} — close to a perfect week. One clean week likely locks in top-tier.`,
    });
  }

  if (d.dcr !== null && d.dcr >= 99.5) well.push({ title: `Completion rate ${d.dcr}% — excellent.` });
  if (d.pod !== null && d.pod >= 99) well.push({ title: `Photo quality ${d.pod}% — photos are clean and defensible.` });
  if (!ev.feedback.length) well.push({ title: "Zero customer complaints this week." });
  if (!controllableRts.length && !ev.rts.length) well.push({ title: "No packages returned to station." });
  if ((d.delivered || 0) >= 400) well.push({ title: `Heavy volume handled: ${d.delivered.toLocaleString()} packages delivered.` });

  return { severe, improve, grow, well, events: ev };
}
