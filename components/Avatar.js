const PALETTE = ["#adadfb", "#7dbbff", "#6be6d3", "#71dd8c", "#b899eb", "#a0bce8", "#ffd08a"];

export function initials(name) {
  const parts = (name || "?").trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function colorFor(name) {
  let h = 0;
  for (const c of name || "") h = (h * 31 + c.charCodeAt(0)) % 997;
  return PALETTE[h % PALETTE.length];
}

export default function Avatar({ name, size = 28 }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}
