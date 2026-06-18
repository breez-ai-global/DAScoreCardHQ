"use client";

import { useScope } from "./ScopeProvider";

export default function WeekPicker() {
  const { scope, setScope, scopes, labels } = useScope();
  return (
    <div className="weekpicker no-print">
      <span className="wp-label">📅 Viewing</span>
      <select value={scope} onChange={(e) => setScope(e.target.value)}>
        {scopes.map((s) => (
          <option key={s} value={s}>
            {s === "all" ? "All weeks (aggregate)" : labels[s] || s}
          </option>
        ))}
      </select>
    </div>
  );
}
