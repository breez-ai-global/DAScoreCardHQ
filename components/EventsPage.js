import Shell from "./Shell";

export default function EventsPage({ title, sub, rows }) {
  const cols = rows.length
    ? Object.keys(rows[0]).filter((k) => rows.some((r) => r[k] && r[k] !== "--"))
    : [];
  return (
    <Shell>
      <h1 className="page-title">{title}</h1>
      <p className="page-sub">{sub}</p>
      <div className="panel">
        {rows.length === 0 ? (
          <p className="muted">No events loaded.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data">
              <thead>
                <tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>{cols.map((c) => <td key={c}>{r[c] || "—"}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
