"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function b64url(obj) {
  const json = JSON.stringify(obj);
  const b = btoa(unescape(encodeURIComponent(json)));
  return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const SEVERITIES = [
  { value: "coaching", label: "Coaching Conversation" },
  { value: "warning", label: "Formal Warning (pre-termination)" },
  { value: "final", label: "Final Warning + Success Plan" },
];

export default function CoachingBuilder({ drivers }) {
  const params = useSearchParams();
  const preselect = params.get("driver") || "";

  const [driverId, setDriverId] = useState(preselect);
  const [severity, setSeverity] = useState("coaching");
  const [summary, setSummary] = useState("");
  const [expectations, setExpectations] = useState(
    "Follow delivery instructions on every stop.\nTake clear POD photos at the correct drop location.\nContact dispatch before marking any package RTS."
  );
  const [plan, setPlan] = useState(
    "Week 1: Ride-along review of delivery photos with dispatch.\nWeek 2: Daily check-in on CDF and RTS before route end.\nWeek 3-4: Maintain zero negative feedback and POD ≥ 98%."
  );
  const [reviewDate, setReviewDate] = useState("");
  const [link, setLink] = useState("");

  const driver = useMemo(
    () => drivers.find((d) => d.id === driverId),
    [drivers, driverId]
  );

  function autoSummary(d) {
    if (!d) return "";
    const parts = [];
    if (d.metrics.feedback) parts.push(`${d.metrics.feedback} negative customer feedback event(s)`);
    if (d.metrics.concessions) parts.push(`${d.metrics.concessions} concession(s)`);
    if (d.metrics.rts) parts.push(`${d.metrics.rts} RTS event(s)`);
    if (d.metrics.pod !== null && d.metrics.pod < 97) parts.push(`POD acceptance at ${d.metrics.pod}%`);
    if (d.metrics.dcr !== null && d.metrics.dcr < 99) parts.push(`DCR at ${d.metrics.dcr}%`);
    if (!parts.length) return "Performance review and coaching.";
    return `During ${d.week}, the following performance issues were identified: ${parts.join(
      "; "
    )}. Recent events:\n` +
      d.issues
        .slice(0, 8)
        .map((i) => `• [${i.type}] ${i.date} — ${i.detail}`)
        .join("\n");
  }

  function selectDriver(id) {
    setDriverId(id);
    const d = drivers.find((x) => x.id === id);
    setSummary(autoSummary(d));
    setLink("");
  }

  useMemo(() => {
    if (preselect && !summary) {
      const d = drivers.find((x) => x.id === preselect);
      if (d) setSummary(autoSummary(d));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function generate() {
    if (!driver) return;
    const payload = {
      v: 1,
      driver: { id: driver.id, name: driver.name },
      week: driver.week,
      severity,
      summary,
      expectations,
      plan: severity === "coaching" ? "" : plan,
      metrics: driver.metrics,
      reviewDate,
      issuedBy: "Breez Global Logistics LLC — Management",
      issuedAt: new Date().toISOString().slice(0, 10),
    };
    const url = `${window.location.origin}/coaching/view?d=${b64url(payload)}`;
    setLink(url);
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
        <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
          {SEVERITIES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <label>Issue Summary</label>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={7} />

        <label>Expectations</label>
        <textarea value={expectations} onChange={(e) => setExpectations(e.target.value)} />

        {severity !== "coaching" && (
          <>
            <label>Success Plan</label>
            <textarea value={plan} onChange={(e) => setPlan(e.target.value)} />
          </>
        )}

        <label>Review Date</label>
        <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />

        <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
          <button className="btn" onClick={generate} disabled={!driver}>
            Generate Shareable Link
          </button>
        </div>

        {link && (
          <div className="share-box">
            <div style={{ marginBottom: 8 }}>
              <a href={link} target="_blank" rel="noreferrer">Open report ↗</a>
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
