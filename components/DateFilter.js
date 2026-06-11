"use client";

// Shared date-range filter. Items must carry a sortable date string (YYYY-MM-DD…).
import { useMemo, useState } from "react";

export function useDateFilter(items, getDate) {
  const [mode, setMode] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    if (mode === "all") return items;
    const now = new Date();
    let lo = "";
    let hi = "9999";
    if (mode === "7d") {
      lo = new Date(now - 7 * 864e5).toISOString().slice(0, 10);
    } else if (mode === "thisweek") {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay()); // Sunday start (Amazon week)
      lo = d.toISOString().slice(0, 10);
    } else if (mode === "custom") {
      lo = from || "";
      hi = to ? to + "~" : "9999";
    }
    return items.filter((it) => {
      const dt = (getDate(it) || "").slice(0, 10);
      return dt >= lo && dt <= hi;
    });
  }, [items, mode, from, to, getDate]);

  const controls = (
    <div className="datefilter no-print">
      <select value={mode} onChange={(e) => setMode(e.target.value)}>
        <option value="all">All dates</option>
        <option value="thisweek">This week</option>
        <option value="7d">Last 7 days</option>
        <option value="custom">Custom range…</option>
      </select>
      {mode === "custom" && (
        <>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="muted">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </>
      )}
      <span className="count">
        {filtered.length} of {items.length}
      </span>
    </div>
  );

  return [filtered, controls];
}
