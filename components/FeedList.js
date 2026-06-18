"use client";

import FeedItem from "./FeedItem";
import { useDateFilter } from "./DateFilter";
import { useScope } from "./ScopeProvider";
import { weekOfDate } from "../lib/weekutil";

export default function FeedList({ items, emptyText = "Nothing recorded. 🎉" }) {
  const { scope } = useScope();
  // Scope to the selected week first, then allow finer date filtering within it.
  const scoped = scope === "all" ? items : items.filter((it) => weekOfDate(it.when) === scope);
  const [filtered, controls] = useDateFilter(scoped, (it) => it.when);
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
