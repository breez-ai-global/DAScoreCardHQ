"use client";

import { useRouter } from "next/navigation";

export default function DriverSwitcher({ drivers, currentId }) {
  const router = useRouter();
  return (
    <select
      className="driver-switcher"
      value={currentId}
      onChange={(e) => router.push(`/drivers/${encodeURIComponent(e.target.value)}`)}
    >
      {drivers.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name} — {d.tierText || "—"} ({d.overall ?? "—"})
        </option>
      ))}
    </select>
  );
}
