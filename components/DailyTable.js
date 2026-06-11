"use client";

import Term from "./Term";
import { useDateFilter } from "./DateFilter";

export default function DailyTable({ rows }) {
  const [filtered, controls] = useDateFilter(rows, (r) => r.day);
  return (
    <>
      {controls}
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th><Term k="Delivered">Delivered</Term></th>
              <th><Term k="DCR">DCR</Term></th>
              <th><Term k="POD">POD</Term></th>
              <th><Term k="CDF">CDF DPMO</Term></th>
              <th><Term k="DSB">DSB</Term></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.day}>
                <td>{r.day}</td>
                <td>{r.delivered}</td>
                <td>{r.dcr}</td>
                <td>{r.pod}</td>
                <td>{r.cdf}</td>
                <td>{r.dsb}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <p className="muted">No days in this range.</p>}
      </div>
    </>
  );
}
