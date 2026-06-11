import Logo from "./Logo";
import NavLinks from "./NavLinks";
import ThemeToggle from "./ThemeToggle";
import { loadData } from "../lib/data";
import { disputeFlags } from "../lib/insights";

export default function Shell({ children }) {
  let disputeCount = 0;
  try {
    disputeCount = disputeFlags(loadData()).length;
  } catch {}
  return (
    <>
      <div className="mobilebar">
        <div className="mb-top">
          <Logo size={28} />
          <span className="name">Breez Global · DA Scorecard HQ</span>
          <ThemeToggle compact />
        </div>
        <div className="mb-nav">
          <NavLinks disputeCount={disputeCount} />
        </div>
      </div>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <Logo size={40} />
            <div>
              <div className="name">Breez Global</div>
              <div className="sub">DA Scorecard HQ</div>
            </div>
          </div>
          <NavLinks disputeCount={disputeCount} />
          <ThemeToggle />
        </aside>
        <main className="main">{children}</main>
      </div>
    </>
  );
}
