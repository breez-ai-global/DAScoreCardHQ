"use client";

import FeedItem from "./FeedItem";
import { useDateFilter } from "./DateFilter";

export default function FeedList({ items, emptyText = "Nothing recorded. 🎉" }) {
  const [filtered, controls] = useDateFilter(items, (it) => it.when);
  return (
    <>
      {controls}
      <div className="feed">
        {filtered.map((it, i) => (
          <FeedItem key={i} {...it} />
        ))}
        {!filtered.length && <p className="muted">{emptyText}</p>}
      </div>
    </>
  );
}
