"use client";

// Public, link-shareable coaching report. The full report payload is encoded
// in the URL (?d=base64url) so no database is needed and the link can be sent
// directly to a DA.
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Logo from "../../../components/Logo";

function decode(d) {
  try {
    const b = d.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b + "===".slice((b.length + 3) % 4);
    return JSON.parse(decodeURIComponent(escape(atob(pad))));
  } catch {
    return null;
  }
}

const SEVERITY_LABEL = {
  coaching: ["Coaching Conversation", "coaching"],
  warning: ["Formal Warning", "warning"],
  final: ["Final Warning — Success Plan", "final"],
};

function Report() {
  const params = useSearchParams();
  const payload = decode(params.get("d") || "");

  if (!payload)
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1>Invalid report link</h1>
        </div>
      </div>
    );

  const [sevLabel, sevClass] = SEVERITY_LABEL[payload.severity] || SEVERITY_LABEL.coaching;
  const m = payload.metrics || {};

  return (
    <div style={{ padding: "40px 16px" }}>
      <div className="report">
        <div className="report-header">
          <Logo size={48} />
          <div>
            <h1>Breez Global Logistics LLC</h1>
            <div className="muted" style={{ fontSize: 13 }}>
              Delivery Associate Performance Document
            </div>
          </div>
          <span className={`severity ${sevClass}`}>{sevLabel}</span>
        </div>

        <h3>Delivery Associate</h3>
        <p>
          <strong>{payload.driver?.name}</strong>{" "}
          <span className="muted">({payload.driver?.id})</span>
        </p>
        <p className="muted">
          Period: {payload.week} · Issued: {payload.issuedAt}
          {payload.reviewDate ? ` · Review date: ${payload.reviewDate}` : ""}
        </p>

        <h3>Performance Snapshot</h3>
        <table className="data">
          <tbody>
            <tr><td>Overall Score</td><td>{m.overall ?? "—"}</td></tr>
            <tr><td>Packages Delivered</td><td>{m.delivered ?? "—"}</td></tr>
            <tr><td>Delivery Completion Rate</td><td>{m.dcr != null ? m.dcr + "%" : "—"}</td></tr>
            <tr><td>POD Acceptance</td><td>{m.pod != null ? m.pod + "%" : "—"}</td></tr>
            <tr><td>CDF DPMO</td><td>{m.cdf ?? "—"}</td></tr>
            <tr><td>Negative Feedback / Concessions / RTS</td><td>{m.feedback ?? 0} / {m.concessions ?? 0} / {m.rts ?? 0}</td></tr>
          </tbody>
        </table>

        <h3>Issue Summary</h3>
        {String(payload.summary || "").split("\n").map((l, i) => <p key={i}>{l}</p>)}

        <h3>Expectations Going Forward</h3>
        {String(payload.expectations || "").split("\n").map((l, i) => <p key={i}>{l}</p>)}

        {payload.plan && (
          <>
            <h3>Success Plan</h3>
            {String(payload.plan).split("\n").map((l, i) => <p key={i}>{l}</p>)}
          </>
        )}

        {payload.severity !== "coaching" && (
          <>
            <h3>Acknowledgement</h3>
            <p style={{ fontSize: 13.5 }}>
              This document serves as a formal record. Failure to meet the
              expectations above by the review date may result in further
              disciplinary action, up to and including termination of the
              delivery associate agreement.
            </p>
          </>
        )}

        <div className="sig-row">
          <div className="sig">Delivery Associate Signature / Date</div>
          <div className="sig">Manager Signature / Date</div>
        </div>

        <div className="no-print" style={{ marginTop: 28 }}>
          <button className="btn" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      </div>
    </div>
  );
}

export default function CoachingView() {
  return (
    <Suspense>
      <Report />
    </Suspense>
  );
}
