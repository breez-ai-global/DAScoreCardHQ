"use client";

import { useEffect, useState } from "react";
import Avatar from "./Avatar";

const SEV = {
  excellent: ["Excellent", "good"],
  positive: ["Positive", "mint"],
  coaching: ["Coaching", "neutral"],
  warning1: ["Formal Warning 1", "gold"],
  warning2: ["Formal Warning 2", "gold"],
  pretermination: ["Pre-Termination", "bronze"],
  final: ["Final Warning", "risk"],
  // legacy value from earlier reports
  warning: ["Formal Warning", "gold"],
};

export default function ReportsList() {
  const [reports, setReports] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/reports", { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      setReports(await res.json());
    } catch (e) {
      setError(String(e.message || e));
      setReports([]);
    }
  }

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("bgl-reports-changed", h);
    return () => window.removeEventListener("bgl-reports-changed", h);
  }, []);

  async function copy(id) {
    await navigator.clipboard.writeText(`${window.location.origin}/coaching/view?id=${id}`);
  }

  return (
    <div className="panel">
      <h2>📋 Issued Reports</h2>
      {reports === null && <p className="muted">Loading…</p>}
      {error && (
        <p className="muted" style={{ fontSize: 12.5 }}>
          Report ledger unavailable ({error}). Reports created with self-contained links aren&apos;t tracked here.
        </p>
      )}
      {reports?.length === 0 && !error && <p className="muted">No reports issued yet.</p>}
      {reports?.map((r) => {
        const [sevLabel, sevClass] = SEV[r.severity] || SEV.coaching;
        return (
          <div className="report-row" key={r.id}>
            <Avatar name={r.driver?.name} size={32} />
            <div className="grow">
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.driver?.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                Issued {(r.createdAt || "").slice(0, 10)} by {r.manager?.name || "—"}
              </div>
            </div>
            <span className={`pill ${sevClass}`}>{sevLabel}</span>
            <span className="status" style={{ color: "var(--green)" }}>
              <span className="dot" style={{ background: "var(--green)" }} /> Manager signed
            </span>
            {r.da?.signedAt ? (
              <span className="status" style={{ color: "var(--green)" }}>
                <span className="dot" style={{ background: "var(--green)" }} /> DA signed {(r.da.signedAt || "").slice(0, 10)}
              </span>
            ) : (
              <span className="status" style={{ color: "var(--amber)" }}>
                <span className="dot" style={{ background: "var(--amber)" }} /> Awaiting DA signature
              </span>
            )}
            <a href={`/coaching/view?id=${r.id}`} target="_blank" rel="noreferrer" className="btn secondary" style={{ padding: "6px 12px" }}>
              Open
            </a>
            <button className="btn secondary" style={{ padding: "6px 12px" }} onClick={() => copy(r.id)}>
              Copy link
            </button>
          </div>
        );
      })}
    </div>
  );
}
