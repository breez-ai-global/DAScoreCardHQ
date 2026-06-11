import { TIPS } from "../lib/glossary";

// Wraps a label with a hover/focus tooltip explaining the code.
export default function Term({ k, children }) {
  const t = TIPS[k];
  if (!t) return children ?? k;
  return (
    <span className="term" tabIndex={0} data-tip={t}>
      {children ?? k}
    </span>
  );
}
