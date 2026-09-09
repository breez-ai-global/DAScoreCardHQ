"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "../../../components/Logo";

export default function PlannerLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const res = await fetch("/api/planner-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/scorecard-planner");
      router.refresh();
    } else {
      setError(true);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">
          <Logo size={72} />
        </div>
        <h1>Scorecard Planner</h1>
        <p className="login-sub">Deconstruct any Amazon DSP scorecard</p>
        <input
          type="password"
          placeholder="Enter planner password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <div className="login-error">Incorrect password</div>}
        <button type="submit" disabled={busy || !password}>
          {busy ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
