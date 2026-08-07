"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { makeManagerSummary, defaultsFor, REPORT_TYPES } from "../lib/reportTone";

function b64url(obj) {
  const json = JSON.stringify(obj);
  const b = btoa(unescape(encodeURIComponent(json)));
  return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const START = defaultsFor("coaching");

export default function CoachingBuilder({ drivers }) {
  const params = useSearchParams();
  const preselect = params.get("driver") || "";

  const [driverId, setDriverId] = useState(preselect);
  const [severity, setSeverity] = useState("coaching");
  const [managerName, setManagerName] = useState("");
  const [summary, setSummary] = useState("");
  const [expectations, setExpectations] = useState(START.expectations);
  const [plan, setPlan] = useState(START.plan);
  const [reviewDate, setReviewDate] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const driver = useMemo(() => drivers.find((d) => d.id === driverId), [drivers, driverId]);

  function regenSummary(id = driverId, sev = severity) {
    const d = drivers.find((x) => x.id === id);
    if (d) setSummary(makeManagerSummary(sev, d));
  }

  function selectDriver(id) {
    setDriverId(id);
    setLink("");
    regenSummary(id, severity);
  }

  function selectSeverity(sev) {
    setSeverity(sev);
    regenSummary(driverId, sev);
    const def = defaultsFor(sev);
    setExpectations(def.expectations);
    setPlan(def.plan);
  }

  useEffect(() => {
    if (preselect) regenSummary(preselect, "coaching");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    if (!driver || !managerName.trim()) return;
    setBusy(true);
    setErr("");
    const id = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now());
    const payload = {
      v: 2,
      id,
      driver: { id: driver.id, name: driver.name },
      week: driver.week,
      severity,
      summary,
      expectations,
      plan,
      metrics: driver.metrics,
      reviewDate,
      manager: { name: managerName.trim(), signedAt: new Date().toISOString() },
      da: null,
      createdAt: new Date().toISOString(),
    };
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || "save failed");
      setLink(`${window.location.origin}/coaching/view?id=${id}`);
      window.dispatchEvent(new Event("bgl-reports-changed"));
    } catch (e) {
      // Storage unavailable — fall back to a self-contained link (no DA e-sign tracking)
      setErr("Couldn't save to the report ledger (" + e.message + "). Generated a self-contained link instead — signing status won't be tracked.");
      setLink(`${window.location.origin}/coaching/view?d=${b64url(payload)}`);
    }
    setBusy(false);
  }

  async function copy() {
    await navigator.clipboard.writeText(link);
  }

  return (
    <div className="grid-2">
      <div className="panel coach-form">
        <h2>Report Builder</h2>

        <label>Driver</label>
        <select value={driverId} onChange={(e) => selectDriver(e.target.value)}>
          <option value="">Select a driver…</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} {d.metrics.feedback + d.metrics.concessions + d.metrics.rts > 0 ? "⚠" : ""}
            </option>
          ))}
        </select>

        <label>Report Type</label>
        <select value={severity} onChange={(e) => selectSeverity(e.target.value)}>
          {REPORT_TYPES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <label>Manager Summary (auto-written to match the report type — edit freely)</label>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={10} />

        <label>Expectations</label>
        <textarea value={expectations} onChange={(e) => setExpectations(e.target.value)} />

        <label>Success Plan</label>
        <textarea value={plan} onChange={(e) => setPlan(e.target.value)} />

        <label>Review Date</label>
        <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />

        <label>Your name (signs the report as manager)</label>
        <input
          type="text"
          placeholder="e.g. Ameer Brown"
          value={managerName}
          onChange={(e) => setManagerName(e.target.value)}
        />
        {managerName.trim() && (
          <div className="signature" style={{ marginTop: 8, borderBottom: "none" }}>{managerName.trim()}</div>
        )}

        <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
          <button className="btn" onClick={generate} disabled={!driver || !managerName.trim() || busy}>
            {busy ? "Signing & saving…" : "Sign & Create Report"}
          </button>
        </div>

        {err && <p style={{ color: "var(--amber)", fontSize: 12.5 }}>{err}</p>}

        {link && (
          <div className="share-box">
            <div style={{ marginBottom: 8 }}>
              <a href={link} target="_blank" rel="noreferrer">Open report ↗</a> — send this link to the DA to review &amp; sign
            </div>
            {link}
            <div style={{ marginTop: 10 }}>
              <button className="btn secondary" onClick={copy}>Copy link</button>
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Driver Snapshot</h2>
        {!driver ? (
          <p className="muted">Pick a driver to see their current numbers and recent events.</p>
        ) : (
          <>
            <div className="cards" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <Snap label="Overall" v={driver.metrics.overall} />
              <Snap label="Delivered" v={driver.metrics.delivered} />
              <Snap label="DCR %" v={driver.metrics.dcr} />
              <Snap label="POD %" v={driver.metrics.pod} />
              <Snap label="CDF DPMO" v={driver.metrics.cdf} />
              <Snap label="Events" v={driver.metrics.feedback + driver.metrics.concessions + driver.metrics.rts} />
            </div>
            {driver.issues.length > 0 && (
              <>
                <h2 style={{ marginTop: 10 }}>Recent Events</h2>
                <table className="data">
                  <thead>
                    <tr><th>Type</th><th>Date</th><th>Detail</th></tr>
                  </thead>
                  <tbody>
                    {driver.issues.slice(0, 12).map((i, idx) => (
                      <tr key={idx}>
                        <td><span className={`pill ${i.type === "RTS" ? "neutral" : "risk"}`}>{i.type}</span></td>
                        <td>{i.date || "—"}</td>
                        <td style={{ whiteSpace: "normal" }}>{i.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Snap({ label, v }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="value" style={{ fontSize: 20 }}>{v === null || v === undefined ? "—" : v}</div>
    </div>
  );
}
