// Breez Composite Score — client-safe, no fs imports.
//
// Philosophy (set with the owner):
//  • Start from Amazon's Overall Score as the quality baseline.
//  • Returns to station, customer complaints, and concessions pull it DOWN,
//    measured as rates per 1,000 packages so one slip on a small route doesn't
//    explode (volume floor) and a high-volume driver isn't punished just for
//    handling more stops.
//  • Volume PUSHES it up — but only when paired with quality. A driver who runs
//    high volume AND keeps scores high earns the biggest reward; the same score
//    on a tiny route earns almost none ("they had less chance to mess up").
//  • Weights are owner-tuned (see SCORE_CFG): complaints bite hardest, the
//    volume bonus is the strongest mover, and returns/concessions are light.
//
// The headline number drivers see IS this composite. Amazon's raw score is kept
// alongside as a reference.

// ---- tunable weights ----
export const SCORE_CFG = {
  volFloor: 400,        // min denominator for rate math (protects tiny routes)
  pComplaint: 4.0,      // points per (complaints per 1,000)
  pRts: 0.5,            // points per (controllable RTS per 1,000)
  pConcession: 1.0,     // points per (concessions per 1,000)
  penaltyCap: 35,       // most a driver can lose from defects
  bonusMax: 12,         // most a driver can gain from proven high volume
  volLow: 200,          // volume where the bonus starts (factor 0)
  volHigh: 1500,        // volume where the bonus maxes (factor 1)
  qualLow: 80,          // base score where the bonus starts (factor 0)
  qualHigh: 98,         // base score where the bonus maxes (factor 1)
};

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

// Compute the composite. `base` = Amazon overall (0-100) or null.
export function breezScore(
  { amazonOverall, delivered, complaints = 0, controllableRts = 0, concessions = 0 },
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
      parts: { complaints, controllableRts, concessions, compPts: 0, rtsPts: 0, concPts: 0 },
    };
  }

  const vol = delivered || 0;
  const denom = Math.max(vol, cfg.volFloor);
  const per1000 = (n) => ((n || 0) / denom) * 1000;

  const compPts = cfg.pComplaint * per1000(complaints);
  const rtsPts = cfg.pRts * per1000(controllableRts);
  const concPts = cfg.pConcession * per1000(concessions);
  const penalty = Math.min(cfg.penaltyCap, compPts + rtsPts + concPts);

  const volFactor = clamp((vol - cfg.volLow) / (cfg.volHigh - cfg.volLow), 0, 1);
  const qualFactor = clamp((base - cfg.qualLow) / (cfg.qualHigh - cfg.qualLow), 0, 1);
  const bonus = cfg.bonusMax * volFactor * qualFactor;

  const raw = base - penalty + bonus;
  const score = Math.round(clamp(raw, 0, 100) * 10) / 10;
  // Unclamped value for ranking, plus a tiny volume nudge so that two drivers
  // with the same raw score are ordered by who carried more volume.
  const rankValue = raw + Math.min(vol, 5000) * 1e-5;

  return {
    score,
    rankValue,
    base,
    penalty: Math.round(penalty * 10) / 10,
    bonus: Math.round(bonus * 10) / 10,
    parts: {
      complaints,
      controllableRts,
      concessions,
      compPts: Math.round(compPts * 10) / 10,
      rtsPts: Math.round(rtsPts * 10) / 10,
      concPts: Math.round(concPts * 10) / 10,
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
  if (s.penalty > 0) {
    const p = s.parts;
    const why = [];
    if (p.compPts > 0) why.push(`complaints −${p.compPts}`);
    if (p.rtsPts > 0) why.push(`returns −${p.rtsPts}`);
    if (p.concPts > 0) why.push(`concessions −${p.concPts}`);
    bits.push(`−${s.penalty} (${why.join(", ")})`);
  }
  return `${bits.join(", ")} = Breez ${s.score}.`;
}
