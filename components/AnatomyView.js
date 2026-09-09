"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  METRICS,
  THRESHOLDS,
  rawToSubScore,
  subScoreTier,
  computeOverall,
  rankLevers,
  overallTier,
} from "../lib/amazonModel";

// Breez DTG5 — Week 35 2026, used as the worked example. Safety metrics were all
// Fantastic; exact event rates aren't printed, so they're shown at a nominal
// Fantastic-tier value (editable below).
const W35 = {
  dc: 3123.2, dsb: 1038, cdf: 1121, ced: 0, pod: 99.61, fleet: 7.14,
  speeding: 2, seatbelt: 2, signSignal: 2, distractions: 2, following: 2,
};
const W35_PRINTED = 72.3;

const TIER_CLS = {
  "Fantastic Plus": "tier-fantastic", Fantastic: "tier-fantastic",
  Great: "tier-great", Fair: "tier-fair", Poor: "tier-poor",
};

function fmt(n, d = 1) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: d });
}

export default function AnatomyView() {
  const [vals, setVals] = useState(W35);
  const model = useMemo(() => computeOverall(vals), [vals]);
  const levers = useMemo(() => rankLevers(vals, 90), [vals]);
  const t = overallTier(model.gatedOverall);

  return (
    <div className="anat">
      <div className="anat-head">
        <h1>Scorecard Anatomy</h1>
        <p>
          How Amazon turns raw driver numbers into your weekly Overall Standing — and which
          levers actually move it. Numbers below are pre-filled with Week&nbsp;35; edit any raw
          value to see the math react.
        </p>
        <Link className="anat-plannerlink" href="/scorecard-planner">
          Open the standalone Scorecard Planner →
        </Link>
      </div>

      {/* two-layer explanation */}
      <section className="pl-card">
        <div className="pl-step">The two-layer math</div>
        <div className="anat-layers">
          <div className="anat-layer">
            <div className="anat-layernum">Layer 1</div>
            <div className="anat-layertitle">Raw number → metric sub-score (0–100)</div>
            <p>
              Each metric&apos;s raw value is mapped onto a 0–100 sub-score by a <b>continuous,
              piecewise-linear</b> curve anchored at the tier edges (Fantastic / Great / Fair /
              Poor). It is <b>not</b> a step function — that&apos;s the only way a card can show one
              metric Fantastic and another Poor and still reconcile to the printed Overall.
            </p>
          </div>
          <div className="anat-layer">
            <div className="anat-layernum">Layer 2</div>
            <div className="anat-layertitle">Sub-scores → Overall</div>
            <p>
              The Overall is a <b>linear weighted average</b> of those sub-scores using the
              effective weights on the right, then mapped to a band: Poor &lt;40, Fair 40–60,
              Great 60–80, Fantastic 80–95, Fantastic&nbsp;Plus 95+.
            </p>
            <p className="anat-gate">
              Two gates apply: the Overall can&apos;t exceed your Safety &amp; Compliance score, and a
              Fantastic Overall is &quot;Capped for Quality&quot; unless Delivery Quality is Fantastic too.
            </p>
          </div>
        </div>
      </section>

      {/* worked breakdown */}
      <section className="pl-card">
        <div className="pl-step">Worked breakdown</div>
        <div className="pl-overallrow">
          <div className="pl-bigscore">
            <div className="pl-bs-num">{fmt(model.gatedOverall)}</div>
            <div className={`pl-bs-tier ${TIER_CLS[t.label] || "tier-nodata"}`}>{t.label}</div>
            <div className="pl-bs-lab">Modeled Overall</div>
          </div>
          <div className="pl-calib">
            Week&nbsp;35 printed <b>{fmt(W35_PRINTED)} · Great</b>. This model reconstructs{" "}
            <b>{fmt(model.gatedOverall)}</b> from the raw numbers using estimated thresholds — the
            <i> ranking</i> of what helps and hurts is what matters here, not the absolute number.
            The standalone planner calibrates to your printed Overall so the gap is zero.
          </div>
        </div>
        <div className="pl-tablewrap">
          <table className="pl-table">
            <thead>
              <tr>
                <th>Metric</th><th>Group</th><th className="num">Raw</th>
                <th className="num">Sub-score</th><th>Tier</th>
                <th className="num">Weight</th><th className="num">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => {
                const raw = vals[m.key];
                const sub = rawToSubScore(m.key, raw);
                const tt = subScoreTier(sub);
                const contrib = sub !== null && model.weightCovered
                  ? (sub * m.weight) / model.weightCovered : null;
                return (
                  <tr key={m.key}>
                    <td>
                      <div className="pl-mname">{m.label}</div>
                      <div className="pl-munit">
                        {THRESHOLDS[m.key]?.dir === "up" ? "higher better" : "lower better"} · {m.unit}
                      </div>
                    </td>
                    <td className="pl-grp">{m.group}</td>
                    <td className="num">
                      <input className="pl-raw" inputMode="decimal" value={raw ?? ""}
                        onChange={(e) => setVals((v) => ({ ...v, [m.key]: e.target.value === "" ? undefined : Number(e.target.value) }))} />
                    </td>
                    <td className="num">{sub === null ? "—" : fmt(sub)}</td>
                    <td className={TIER_CLS[tt.label] || "tier-nodata"}>{tt.label || "—"}</td>
                    <td className="num pl-wt">{fmt(m.weight)}%</td>
                    <td className="num">{contrib === null ? "—" : fmt(contrib)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="pl-legend">
          Effective weights redistribute the metrics Amazon currently zeroes out (FICO, Tenured
          Workforce) or hasn&apos;t switched on (Pickup). Safety is ~48% of the whole card, so it&apos;s
          the floor everything else sits under.
        </div>
      </section>

      {/* levers */}
      <section className="pl-card">
        <div className="pl-step">Which levers to dial</div>
        <div className="pl-leverhead">
          Points added to your Overall if each metric were lifted to a Fantastic sub-score (90),
          highest first. This is where effort actually pays.
        </div>
        <div className="pl-bars">
          {levers.filter((l) => l.overallGain > 0).map((l) => {
            const max = levers[0]?.overallGain || 1;
            return (
              <div className="pl-barrow" key={l.key}>
                <div className="pl-barlab">{l.label}</div>
                <div className="pl-bartrack">
                  <div className="pl-barfill" style={{ width: `${Math.max(4, (l.overallGain / max) * 100)}%` }} />
                </div>
                <div className="pl-barval">+{fmt(l.overallGain)}</div>
              </div>
            );
          })}
          {levers.filter((l) => l.overallGain > 0).length === 0 && (
            <div className="pl-calib-hint">Every metric is already at Fantastic. 🎉</div>
          )}
        </div>
      </section>
    </div>
  );
}
