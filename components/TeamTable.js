"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Avatar from "./Avatar";

const TIER_DOT = {
  platinum: "var(--primary)",
  gold: "var(--amber)",
  silver: "var(--cyan)",
  bronze: "var(--red)",
  neutral: "var(--txt-2)",
};

const COLS = [
  ["name", "Driver"],
  ["tierText", "Tier"],
  ["overall", "Score"],
  ["delivered", "Packages"],
  ["dcr", "Completion %"],
  ["pod", "Photo %"],
  ["feedbackCount", "Complaints"],
  ["scanFlags", "Scan Flags"],
  ["urgent", "Urgent Items"],
];

function tierClass(t) {
  const s = (t || "").toLowerCase();
  if (s.includes("platinum")) return "platinum";
  if (s.includes("gold")) return "gold";
  if (s.includes("silver")) return "silver";
  if (s.includes("bronze")) return "bronze";
  return "neutral";
}

export default function TeamTable({ rows }) {
  const [sortKey, setSortKey] = useState("overall");
  const [dir, setDir] = useState(-1);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "string") return va.localeCompare(vb) * dir;
      return (va - vb) * dir;
    });
  }, [rows, sortKey, dir]);

  function clickCol(k) {
    if (k === sortKey) setDir(-dir);
    else {
      setSortKey(k);
      setDir(k === "name" || k === "tierText" ? 1 : -1);
    }
  }

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {COLS.map(([k, label]) => (
              <th key={k} onClick={() => clickCol(k)} style={{ cursor: "pointer" }}>
                {label} {sortKey === k ? (dir === -1 ? "↓" : "↑") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((d) => (
            <tr key={d.id}>
              <td>
                <Link href={`/drivers/${encodeURIComponent(d.id)}`} className="who">
                  <Avatar name={d.name} />
                  <span style={{ color: "var(--txt)", fontWeight: 500 }}>{d.name}</span>
                </Link>
              </td>
              <td>
                {d.tierText ? (
                  <span className="status" style={{ color: TIER_DOT[tierClass(d.tierText)] }}>
                    <span className="dot" style={{ background: TIER_DOT[tierClass(d.tierText)] }} />
                    {d.tierText}
                  </span>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="scorebar">
                    <span
                      style={{
                        width: `${d.overall ?? 0}%`,
                        background:
                          d.overall >= 85 ? "var(--green)" : d.overall >= 70 ? "var(--amber)" : "var(--red)",
                      }}
                    />
                  </span>
                  <strong>{d.overall ?? "—"}</strong>
                </div>
              </td>
              <td>{d.delivered?.toLocaleString() ?? "—"}</td>
              <td>{d.dcr !== null ? d.dcr + "%" : "—"}</td>
              <td className={d.pod !== null && d.pod < 98 ? "tier-poor" : ""}>
                {d.pod !== null ? d.pod.toFixed(1) + "%" : "—"}
              </td>
              <td className={d.feedbackCount ? "" : "tier-great"}>{d.feedbackCount}</td>
              <td className={d.scanFlags ? "tier-fair" : "tier-great"}>{d.scanFlags}</td>
              <td>
                {d.urgent ? (
                  <span className="tier-poor" style={{ fontWeight: 700 }}>{d.urgent}</span>
                ) : (
                  <span className="tier-great">none</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
