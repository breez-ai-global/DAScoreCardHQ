import Logo from "./Logo";
import NavLinks from "./NavLinks";

export default function Shell({ children }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo size={40} />
          <div>
            <div className="name">Breez Global</div>
            <div className="sub">DA Scorecard HQ</div>
          </div>
        </div>
        <NavLinks />
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
