// Breez tier scale — computed from the weekly Overall Score, not Amazon's label.
// Platinum ≥98 · Gold 90–97.9 · Silver 80–89.9 · Bronze 70–79.9 · At Risk <70
// Client-safe (no fs imports).

export const TIER_BANDS = [
  [98, "Platinum", "platinum"],
  [90, "Gold", "gold"],
  [80, "Silver", "silver"],
  [70, "Bronze", "bronze"],
  [-Infinity, "At Risk", "risk"],
];

function clsOf(label) {
  const s = (label || "").toLowerCase();
  if (s.includes("platinum")) return "platinum";
  if (s.includes("gold")) return "gold";
  if (s.includes("silver")) return "silver";
  if (s.includes("bronze")) return "bronze";
  if (s.includes("risk")) return "risk";
  return "neutral";
}

export function scoreTier(overall, amazonTier = null) {
  if (overall === null || overall === undefined) {
    // No score this week — fall back to Amazon's label, marked as theirs.
    return { label: amazonTier || null, cls: clsOf(amazonTier), amazon: null };
  }
  const band = TIER_BANDS.find(([min]) => overall >= min);
  const label = band[1];
  const amazon =
    amazonTier && amazonTier.toLowerCase() !== label.toLowerCase() ? amazonTier : null;
  return { label, cls: band[2], amazon };
}

export function tierTipText(t, overall) {
  if (!t?.amazon) return null;
  return `Amazon grades this week as ${t.amazon}, but on the Breez scale a ${overall} is ${t.label} (Platinum 98+, Gold 90+, Silver 80+, Bronze 70+, At Risk under 70).`;
}
