// Breez Composite Score — client-safe, no fs imports.
//
// Philosophy (set with the owner):
//  • Start from Amazon's Overall Score as the quality baseline.
//  • Returns to station, customer complaints, and concessions pull it DOWN,
//    measured as rates per 1,000 packages so one slip on a small route doesn't
//    explode (volume floor) and a high-volume driver isn't punished just for
//    handling more stops.
//  • Netradyne driving-safety events pull it DOWN harder than customer feedback —
//    the owner's rule is "anything driving related is worse than customer stuff."
//    Impairment (drowsiness/distraction) and following-distance bite hardest;
//    backing is minor. Third-party-caused events are exempt. Positive DriverStars
//    give a small reward.
//  • Volume PUSHES it up — but only when paired with quality.
//  • Remaining weights are owner-tuned (see SCORE_CFG).
//
// The headline number drivers see IS this composite. Amazon's raw score is kept
// alongside as a reference.

// ---- tunable weights ----
export const SCORE_CFG = {
  volFloor: 400,        // min denominator for rate math (protects tiny routes)
  pComplaint: 4.0,      // points per (complaints per 1,000)
  pRts: 0.5,            // points per (controllable RTS per 1,000)
  pConcession: 1.0,     // points per (concessions per 1,000)
  penaltyCap: 35,       // most a driver can lose from Amazon-side defects
  bonusMax: 12,         // most a driver can gain from proven high volume
  volLow: 200,          // volume where the bonus starts (factor 0)
  volHigh: 1500,        // volume where the bonus maxes (factor 1)
  qualLow: 80,          // base score where the bonus starts (factor 0)
  qualHigh: 98,         // base score where the bonus maxes (factor 1)
  // ---- Netradyne safety ----
  kSafety: 1.2,         // multiplier on total weighted safety severity
  safetyCap: 25,        // most a driver can lose from driving-safety events
  tpSeverity: 4,        // severity credited back per third-party (exempt) event
  kStar: 1.0,           // points per positive DriverStar
  starCap: 3,           // most a driver can gain from DriverStars
};

// Per-event driving-safety severity. Higher = more dangerous. Driving-related
// events are deliberately weighted so serious ones outweigh a customer complaint
// (pComplaint 4.0). Backing is common in delivery and kept minor.
export const SAFETY_SEV = {
  drowsiness: 6,
  distraction: 5,
  following: 4,
  seatbelt: 4,
  signSignal: 4,
  speeding: 5,
  hardBraking: 2.5,
  accel: 2.5,
  highG: 2.5,
  backing: 1,
};

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

// Weighted, exemption-adjusted severity for a driver's safety event counts.
export function safetySeverity(safety, cfg = SCORE_CFG) {
  if (!safety) return 0;
  let sev = 0;
  for (const k of Object.keys(SAFETY_SEV)) sev += (safety[k] || 0) * SAFETY_SEV[k];
  sev -= (safety.thirdParty || 0) * cfg.tpSeverity; // third-party events are exempt
  return Math.max(0, Math.round(sev * 10) / 10);
}

// Compute the composite. `base` = Amazon overall (0-100) or null.
export function breezScore(
  { amazonOverall, delivered, complaints = 0, controllableRts = 0, concessions = 0, safety = null },
  cfg = SCORE_CFG
) {
  const base = amazonOverall;
  if (base === null || base === undefined) {
    return {
      score: null,
      rankValue: -1,
      base: null,
      penalty: 0,
      bonus: 0,
      safetyPts: 0,
      starBonus: 0,
      parts: { complaints, controllableRts, concessions, compPts: 0, rtsPts: 0, concPts: 0, safetySev: 0, stars: 0 },
    };
  }

  const vol = delivered || 0;
  const denom = Math.max(vol, cfg.volFloor);
  const per1000 = (n) => ((n || 0) / denom) * 1000;

  const compPts = cfg.pComplaint * per1000(complaints);
  const rtsPts = cfg.pRts * per1000(controllableRts);
  const concPts = cfg.pConcession * per1000(concessions);
  const defectPenalty = Math.min(cfg.penaltyCap, compPts + rtsPts + concPts);

  // Netradyne driving-safety penalty (flat-weighted, not per-1,000 — the safety
  // window differs from the delivery window, so we score raw severity directly).
  const sev = safetySeverity(safety, cfg);
  const safetyPts = Math.min(cfg.safetyCap, cfg.kSafety * sev);
  const stars = (safety && safety.stars) || 0;
  const starBonus = Math.min(cfg.starCap, cfg.kStar * stars);

  const volFactor = clamp((vol - cfg.volLow) / (cfg.volHigh - cfg.volLow), 0, 1);
  const qualFactor = clamp((base - cfg.qualLow) / (cfg.qualHigh - cfg.qualLow), 0, 1);
  const volBonus = cfg.bonusMax * volFactor * qualFactor;

  const raw = base - defectPenalty - safetyPts + volBonus + starBonus;
  const score = Math.round(clamp(raw, 0, 100) * 10) / 10;
  // Unclamped value for ranking, plus a tiny volume nudge so that two drivers
  // with the same raw score are ordered by who carried more volume.
  const rankValue = raw + Math.min(vol, 5000) * 1e-5;

  return {
    score,
    rankValue,
    base,
    penalty: Math.round(defectPenalty * 10) / 10,
    bonus: Math.round(volBonus * 10) / 10,
    safetyPts: Math.round(safetyPts * 10) / 10,
    starBonus: Math.round(starBonus * 10) / 10,
    parts: {
      complaints,
      controllableRts,
      concessions,
      compPts: Math.round(compPts * 10) / 10,
      rtsPts: Math.round(rtsPts * 10) / 10,
      concPts: Math.round(concPts * 10) / 10,
      safetySev: sev,
      stars,
      volFactor: Math.round(volFactor * 100) / 100,
      qualFactor: Math.round(qualFactor * 100) / 100,
    },
  };
}

// One-line plain-English explanation of a score breakdown.
export function scoreExplain(s) {
  if (!s || s.score === null) return "Not enough data to score yet.";
  const bits = [];
  bits.push(`Amazon base ${s.base}`);
  if (s.bonus > 0) bits.push(`+${s.bonus} for proven volume at quality`);
  if (s.starBonus > 0) bits.push(`+${s.starBonus} for DriverStars`);
  if (s.penalty > 0) {
    const p = s.parts;
    const why = [];
    if (p.compPts > 0) why.push(`complaints −${p.compPts}`);
    if (p.rtsPts > 0) why.push(`returns −${p.rtsPts}`);
    if (p.concPts > 0) why.push(`concessions −${p.concPts}`);
    bits.push(`−${s.penalty} (${why.join(", ")})`);
  }
  if (s.safetyPts > 0) bits.push(`−${s.safetyPts} for driving-safety events`);
  return `${bits.join(", ")} = Breez ${s.score}.`;
}
