// Server-rendered SVG charts (no client JS, no deps).

const TIER_COLORS = {
  Platinum: "#adadfb",
  Gold: "#ffd08a",
  Silver: "#a0bce8",
  Bronze: "#ff9e7a",
  "At Risk": "#ff8a8a",
  Unrated: "#3a4664",
};

export function Donut({ mix, size = 220 }) {
  const entries = Object.entries(mix).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  const r = 70;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = 34;
  let acc = -Math.PI / 2;
  const arcs = entries.map(([label, v]) => {
    const frac = v / total;
    const a0 = acc;
    const a1 = acc + frac * Math.PI * 2;
    acc = a1;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1 - 0.02);
    const y1 = cy + r * Math.sin(a1 - 0.02);
    return (
      <path
        key={label}
        d={`M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`}
        fill="none"
        stroke={TIER_COLORS[label] || "#3a4664"}
        strokeWidth={stroke}
      />
    );
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs}
        <text x={cx} y={cy + 6} textAnchor="middle" fill="var(--fog)" fontSize="26" fontWeight="700">
          {total}
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Object.entries(mix)
          .filter(([, v]) => v > 0)
          .map(([label, v]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: TIER_COLORS[label] }} />
              <span>{label}</span>
              <span className="muted">{v}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

export function HBars({ items, color = "var(--breeze)", valueSuffix = "", height = 30, labelWidth = 230 }) {
  const max = Math.max(...items.map(([, v]) => v), 1);
  const width = 560;
  const barArea = width - labelWidth - 50;
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${items.length * height + 6}`}
      style={{ maxWidth: width }}
    >
      {items.map(([label, v, c], i) => {
        const y = i * height;
        const w = Math.max((v / max) * barArea, 2);
        return (
          <g key={label + i}>
            <text x={labelWidth - 10} y={y + height / 2 + 4} textAnchor="end" fill="#aab4cf" fontSize="12">
              {label.length > 34 ? label.slice(0, 33) + "…" : label}
            </text>
            <rect x={labelWidth} y={y + 5} width={w} height={height - 12} rx="4" fill={c || color} />
            <text x={labelWidth + w + 8} y={y + height / 2 + 4} fill="var(--fog)" fontSize="12" fontWeight="600">
              {typeof v === "number" && v % 1 !== 0 ? v.toFixed(1) : v}
              {valueSuffix}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
