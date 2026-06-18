// Historical scope layer: aggregate across all weeks by default, or scope to a
// single week. Weeks are Amazon-style Sun→Sat, anchored on Week 24 = Jun 7 2026.
import {
  loadData,
  allWeeks,
  driversForWeek,
  rankScore,
  pick,
  num,
} from "./data";
import { scoreTier } from "./tiers";
import { disputeFlags, complaintType, rtsPlain } from "./insights";
import { weekOfDate, weekWindow, weekTitle } from "./weekutil";
import { breezScore } from "./score";

export { weekOfDate, weekWindow, weekTitle };

// How many of a driver's scoped RTS events are driver-controllable (DCR-impacting)?
function countControllableRts(rtsEvents) {
  return rtsEvents.filter((e) => (pick(e, "impact dcr") || "").toUpperCase() === "Y").length;
}

// Replace a record's `overall` with the Breez composite, keeping Amazon's raw
// number as `amazonOverall`. Adds rankValue + scoreParts for sorting/transparency.
function applyScore(d) {
  const amazon = d.overall ?? null;
  const s = breezScore({
    amazonOverall: amazon,
    delivered: d.delivered,
    complaints: d.feedbackCount || 0,
    controllableRts: d.controllableRtsCount || 0,
    concessions: d.concessionCount || 0,
  });
  d.amazonOverall = amazon;
  d.overall = s.score;
  d.rankValue = s.rankValue;
  d.scoreParts = s;
  return d;
}

// All selectable scopes: "all" plus every week that has either a scorecard or events, newest first.
export function listScopes(data = loadData()) {
  const weeks = new Set(allWeeks(data));
  const addFrom = (events, keys) => {
    for (const e of events) {
      for (const k of Object.keys(e)) {
        if (keys.includes(k.toLowerCase())) {
          const w = weekOfDate(e[k]);
          if (w) weeks.add(w);
          break;
        }
      }
    }
  };
  addFrom(data.events.feedback, ["delivery date"]);
  addFrom(data.events.rts, ["planned delivery date"]);
  addFrom(data.events.concessions, ["concession date", "delivery date"]);
  const sorted = [...weeks].sort().reverse();
  return ["all", ...sorted];
}

// ---------- event scoping ----------
const EVENT_DATE_KEYS = {
  feedback: ["delivery date"],
  rts: ["planned delivery date"],
  concessions: ["concession date", "delivery date"],
};

function eventDate(e, keys) {
  for (const k of keys) {
    const v = pick(e, k);
    if (v) return String(v).slice(0, 10);
  }
  return "";
}

export function scopeEvents(events, keys, scope) {
  if (scope === "all") return events;
  const w = weekWindow(scope);
  if (!w) return events;
  return events.filter((e) => {
    const d = eventDate(e, keys);
    return d >= w.start && d <= w.end;
  });
}

export function scopedEvents(scope, data = loadData()) {
  return {
    feedback: scopeEvents(data.events.feedback, EVENT_DATE_KEYS.feedback, scope),
    concessions: scopeEvents(data.events.concessions, EVENT_DATE_KEYS.concessions, scope),
    rts: scopeEvents(data.events.rts, EVENT_DATE_KEYS.rts, scope),
  };
}

// ---------- driver matching against a scoped event set ----------
function matcher(id, name) {
  return (e) => {
    const ids = [
      pick(e, "transporter id", "transporter_id"),
      pick(e, "delivery associate id"),
      pick(e, "delivery associate"),
    ].filter(Boolean);
    if (ids.includes(id)) return true;
    const en = pick(e, "delivery associate name", "delivery associate", "name");
    return en && name && en.toLowerCase() === name.toLowerCase();
  };
}

// volume-weighted average across weekly records (weight by packages delivered)
function wavg(recs, key) {
  let num1 = 0, den = 0, simpleSum = 0, simpleN = 0;
  for (const r of recs) {
    const v = r[key];
    if (v === null || v === undefined) continue;
    simpleSum += v;
    simpleN++;
    const w = r.delivered || 0;
    if (w > 0) {
      num1 += v * w;
      den += w;
    }
  }
  if (den > 0) return Math.round((num1 / den) * 100) / 100;
  if (simpleN > 0) return Math.round((simpleSum / simpleN) * 100) / 100;
  return null;
}

// ---------- drivers for a scope ----------
export function driversForScope(scope, data = loadData()) {
  const ev = scopedEvents(scope, data);
  const attachCounts = (d) => {
    const m = matcher(d.id, d.name);
    const myRts = ev.rts.filter(m);
    return {
      ...d,
      feedbackCount: ev.feedback.filter(m).length,
      concessionCount: ev.concessions.filter(m).length,
      rtsEventCount: myRts.length,
      controllableRtsCount: countControllableRts(myRts),
    };
  };

  if (scope !== "all") {
    return driversForWeek(scope, data).map(attachCounts).map(applyScore);
  }

  // Aggregate every scorecard week into one record per driver.
  const weeks = allWeeks(data);
  const byId = new Map();
  for (const wk of weeks) {
    for (const d of driversForWeek(wk, data)) {
      if (!byId.has(d.id)) byId.set(d.id, { id: d.id, name: d.name, recs: [] });
      const g = byId.get(d.id);
      g.recs.push(d);
      if (g.name === "Unknown" || g.name === d.id) g.name = d.name;
    }
  }
  return [...byId.values()].map((g) => {
    const recs = g.recs;
    // Volume-weighted average of Amazon's raw overall across the weeks worked.
    const amazonOverall = wavg(recs, "overall");
    const agg = {
      id: g.id,
      name: g.name,
      week: "all",
      weeksActive: recs.length,
      overall: amazonOverall,
      tierText: null, // no single Amazon standing across multiple weeks
      delivered: recs.reduce((s, r) => s + (r.delivered || 0), 0),
      dcr: wavg(recs, "dcr"),
      dsb: wavg(recs, "dsb"),
      pod: wavg(recs, "pod"),
      cdf: wavg(recs, "cdf"),
      ced: wavg(recs, "ced"),
      rtsCount: recs.reduce((s, r) => s + (r.rtsCount || 0), 0),
      rtsPct: wavg(recs, "rtsPct"),
      rtsDpmo: wavg(recs, "rtsDpmo"),
      raw: recs.flatMap((r) => r.raw || []),
    };
    return applyScore(attachCounts(agg));
  });
}

export function driverForScope(id, scope, data = loadData()) {
  return driversForScope(scope, data).find((d) => d.id === id) || null;
}

// This driver's events, scoped to the week window (for scoped insight sections).
export function driverScopedEvents(id, name, scope, data = loadData()) {
  const ev = scopedEvents(scope, data);
  const m = matcher(id, name);
  return {
    feedback: ev.feedback.filter(m),
    concessions: ev.concessions.filter(m),
    rts: ev.rts.filter(m),
  };
}

// dispute flags scoped to a week window (each flag carries .date)
export function disputeFlagsForScope(scope, data = loadData()) {
  const all = disputeFlags(data);
  if (scope === "all") return all;
  const w = weekWindow(scope);
  if (!w) return all;
  return all.filter((f) => {
    const d = (f.date || "").slice(0, 10);
    return d >= w.start && d <= w.end;
  });
}

// Full overview for a scope — same shape app/page expects, but scoped/aggregated.
export function buildOverview(scope, data = loadData()) {
  const drivers = driversForScope(scope, data);
  const active = drivers.filter((d) => (d.delivered || 0) > 0 || d.overall !== null);
  const ranked = [...active].sort((a, b) => rankScore(b) - rankScore(a));
  const ev = scopedEvents(scope, data);

  const scored = ranked.filter((d) => d.overall !== null);
  const avgScore = scored.length
    ? Math.round((scored.reduce((s, d) => s + d.overall, 0) / scored.length) * 10) / 10
    : null;
  const platinum = ranked.filter((d) => d.overall !== null && d.overall >= 98).length;
  const delivered = ranked.reduce((s, d) => s + (d.delivered || 0), 0);

  const mix = { Platinum: 0, Gold: 0, Silver: 0, Bronze: 0, "At Risk": 0, Unrated: 0 };
  for (const d of ranked) {
    if (d.overall === null || d.overall === undefined) mix.Unrated++;
    else if (d.overall >= 98) mix.Platinum++;
    else if (d.overall >= 90) mix.Gold++;
    else if (d.overall >= 80) mix.Silver++;
    else if (d.overall >= 70) mix.Bronze++;
    else mix["At Risk"]++;
  }

  const complaints = {};
  for (const e of ev.feedback) {
    const t = complaintType(e);
    complaints[t] = (complaints[t] || 0) + 1;
  }
  const rtsReasons = {};
  for (const e of ev.rts) {
    const t = rtsPlain(pick(e, "da selected rts code"));
    rtsReasons[t] = (rtsReasons[t] || 0) + 1;
  }

  const disputes = disputeFlagsForScope(scope, data);
  const attention = ranked.filter(
    (d) => (d.overall !== null && d.overall < 85) || d.feedbackCount > 0 || d.concessionCount > 0
  );

  return {
    scope,
    weeks: allWeeks(data).length,
    ranked: ranked.map((d) => ({
      id: d.id, name: d.name, tierText: d.tierText, overall: d.overall,
      amazonOverall: d.amazonOverall ?? null,
      delivered: d.delivered, dcr: d.dcr, pod: d.pod, cdf: d.cdf,
      feedbackCount: d.feedbackCount, concessionCount: d.concessionCount, rtsEventCount: d.rtsEventCount,
      controllableRtsCount: d.controllableRtsCount || 0,
      weeksActive: d.weeksActive || 1,
    })),
    avgScore,
    platinum,
    total: ranked.length,
    delivered,
    complaintsTotal: ev.feedback.length,
    controllable: controllableForScope(scope, data),
    disputeCount: disputes.length,
    disputes,
    mix,
    complaints,
    rtsReasons,
    attention: attention.map((d) => ({ id: d.id, name: d.name })),
    top3: ranked.slice(0, 3).map((d) => ({ id: d.id, name: d.name })),
  };
}

// controllable returns (from DCR detail) summed across the scope
export function controllableForScope(scope, data = loadData()) {
  const weeks = scope === "all" ? Object.keys(data.details?.dcr || {}) : [scope];
  let total = 0;
  for (const w of weeks) {
    for (const r of data.details?.dcr?.[w] || []) {
      total += num(pick(r, "packages returned to station - da controllable")) || 0;
    }
  }
  return total;
}
