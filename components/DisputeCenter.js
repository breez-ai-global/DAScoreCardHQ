"use client";

import { useEffect, useState } from "react";
import { useDateFilter } from "./DateFilter";
import { useScope } from "./ScopeProvider";
import { weekOfDate } from "../lib/weekutil";

const STATUSES = ["Needs review", "Will dispute", "Disputed - waiting", "Won", "Lost", "Not disputing"];
const PRIORITY_DOT = { High: "var(--red)", Medium: "var(--amber)", "Look into": "var(--breeze)" };

export default function DisputeCenter({ flags: allFlags }) {
  const { scope } = useScope();
  const scopedFlags = scope === "all" ? allFlags : allFlags.filter((f) => weekOfDate(f.date) === scope);
  const [flags, dateControls] = useDateFilter(scopedFlags, (f) => f.date);
  const [state, setState] = useState({});

  useEffect(() => {
    try {
      setState(JSON.parse(localStorage.getItem("bgl_disputes") || "{}"));
    } catch {}
  }, []);

  function update(id, patch) {
    setState((prev) => {
      const next = { ...prev, [id]: { ...(prev[id] || {}), ...patch } };
      try {
        localStorage.setItem("bgl_disputes", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function resetAll() {
    if (!confirm("Reset all dispute statuses and notes?")) return;
    setState({});
    try {
      localStorage.removeItem("bgl_disputes");
    } catch {}
  }

  function exportCsv() {
    const headers = ["Priority", "Driver", "Flag", "Detail", "Why disputable", "Tracking ID", "Date", "Status", "Notes"];
    const lines = [headers.join(",")];
    for (const f of flags) {
      const s = state[f.id] || {};
      const row = [f.priority, f.driver, f.flag, f.detail, f.why, f.ref, f.date, s.status || "Needs review", s.note || ""];
      lines.push(row.map((v) => '"' + String(v || "").replace(/"/g, '""') + '"').join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dispute-list-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <>
      <div className="panel">
        <h2>⚖ Dispute Center — items worth a second look</h2>
        <p style={{ lineHeight: 1.5, color: "#aab4cf", fontSize: 13.5 }}>
          The dashboard automatically flags anything that&apos;s commonly winnable in a dispute or at
          least worth investigating before it dings your scorecard. Review each one, set a status,
          add notes, and export the list to send to your team or file with Amazon.
        </p>
        <div style={{ display: "flex", gap: 18, fontSize: 12.5, flexWrap: "wrap", margin: "8px 0 14px" }}>
          <span><span className="dot" style={{ background: "var(--red)" }} /> <b>High</b> — directly hurting a metric right now</span>
          <span><span className="dot" style={{ background: "var(--amber)" }} /> <b>Medium</b> — likely disputable / exemption may apply</span>
          <span><span className="dot" style={{ background: "var(--breeze)" }} /> <b>Look into</b> — needs context before deciding</span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <button className="btn secondary" onClick={exportCsv}>⬇ Export dispute list (CSV)</button>
          <button className="btn secondary" onClick={resetAll}>↺ Reset all statuses</button>
        </div>
        {dateControls}
      </div>

      <div className="panel">
        <div style={{ overflowX: "auto" }}>
          <table className="data dispute-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Driver</th>
                <th>What Got Flagged</th>
                <th style={{ minWidth: 320 }}>Why It Might Be Disputable / What to Check</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => {
                const s = state[f.id] || {};
                return (
                  <tr key={f.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span className="dot" style={{ background: PRIORITY_DOT[f.priority] }} /> <b>{f.priority}</b>
                    </td>
                    <td style={{ whiteSpace: "normal", minWidth: 120 }}><b>{f.driver}</b></td>
                    <td style={{ whiteSpace: "normal", minWidth: 180 }}>
                      <span className="flag-chip">{f.flag}</span>
                      <div className="muted" style={{ marginTop: 5 }}>{f.detail}</div>
                    </td>
                    <td style={{ whiteSpace: "normal", lineHeight: 1.5, fontSize: 13 }}>{f.why}</td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {f.ref}
                      <br />
                      {f.date}
                    </td>
                    <td>
                      <select
                        value={s.status || "Needs review"}
                        onChange={(e) => update(f.id, { status: e.target.value })}
                        className="dispute-select"
                      >
                        {STATUSES.map((st) => (
                          <option key={st}>{st}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="dispute-note"
                        placeholder="add a note…"
                        value={s.note || ""}
                        onChange={(e) => update(f.id, { note: e.target.value })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
