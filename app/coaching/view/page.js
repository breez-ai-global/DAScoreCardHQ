"use client";

// Public, link-shareable coaching report. New reports load from the ledger by
// id (?id=) and support DocuSign-style click-to-sign. Legacy ?d= links render
// the payload encoded in the URL.
import { Suspense, useEffect, useState } from "react";
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

function fmtDate(iso) {
  return (iso || "").slice(0, 10);
}

function Report() {
  const params = useSearchParams();
  const id = params.get("id");
  const [payload, setPayload] = useState(undefined);
  const [signName, setSignName] = useState("");
  const [signBusy, setSignBusy] = useState(false);
  const [signErr, setSignErr] = useState("");

  useEffect(() => {
    if (id) {
      fetch(`/api/reports?id=${encodeURIComponent(id)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then(setPayload)
        .catch(() => setPayload(null));
    } else {
      setPayload(decode(params.get("d") || ""));
    }
  }, [id, params]);

  async function sign() {
    if (!signName.trim()) return;
    setSignBusy(true);
    setSignErr("");
    try {
      const res = await fetch("/api/reports/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: signName.trim() }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 409) throw new Error(data.error || "sign failed");
      setPayload(data.report);
    } catch (e) {
      setSignErr(String(e.message || e));
    }
    setSignBusy(false);
  }

  if (payload === undefined)
    return (
      <div className="login-wrap">
        <div className="login-card"><h1>Loading report…</h1></div>
      </div>
    );

  if (!payload)
    return (
      <div className="login-wrap">
        <div className="login-card"><h1>Invalid report link</h1></div>
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
          Period: {payload.week} · Issued: {fmtDate(payload.issuedAt || payload.createdAt)}
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

        <h3>From Your Manager</h3>
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
              delivery associate agreement. Signing acknowledges receipt and
              review of this document.
            </p>
          </>
        )}

        <div className="sig-block">
          <div className="sig-card">
            <div className="role">Manager</div>
            <div className="signature">{payload.manager?.name || "—"}</div>
            <div className="at">
              {payload.manager?.signedAt ? `Signed electronically · ${fmtDate(payload.manager.signedAt)}` : "—"}
            </div>
          </div>

          <div className={`sig-card ${payload.da?.signedAt ? "" : "sig-pending"}`}>
            <div className="role">Delivery Associate</div>
            {payload.da?.signedAt ? (
              <>
                <div className="signature">{payload.da.name}</div>
                <div className="at">Signed electronically · {fmtDate(payload.da.signedAt)}</div>
              </>
            ) : id ? (
              <>
                <div className="signature" style={{ color: "var(--txt-3)" }}>
                  {signName.trim() || "Your signature"}
                </div>
                <div className="sign-cta no-print">
                  <input
                    placeholder="Type your full legal name"
                    value={signName}
                    onChange={(e) => setSignName(e.target.value)}
                  />
                  <button className="btn" onClick={sign} disabled={signBusy || signName.trim().length < 2}>
                    {signBusy ? "Signing…" : "Click to Sign"}
                  </button>
                </div>
                <div className="at" style={{ marginTop: 6 }}>
                  By clicking Sign, you acknowledge you have read and received this document.
                </div>
                {signErr && <div style={{ color: "var(--red)", fontSize: 12 }}>{signErr}</div>}
              </>
            ) : (
              <div className="at">Signature tracking unavailable for this link — sign on paper.</div>
            )}
          </div>
        </div>

        <div className="no-print" style={{ marginTop: 28 }}>
          <button className="btn secondary" onClick={() => window.print()}>Print / Save PDF</button>
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
