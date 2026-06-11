"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks({ disputeCount = 0 }) {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Business Overview", icon: "▦" },
    { href: "/drivers", label: "Driver by Driver", icon: "👤" },
    { href: "/disputes", label: "Dispute Center", icon: "⚖", badge: disputeCount },
    { href: "/feedback", label: "Negative Feedback", icon: "⚠" },
    { href: "/concessions", label: "Concessions", icon: "↺" },
    { href: "/rts", label: "Return to Station", icon: "⇄" },
    { href: "/coaching", label: "Coaching Reports", icon: "✎" },
    { href: "/codes", label: "What the Codes Mean", icon: "📖" },
  ];
  return (
    <>
      {links.map((l) => {
        const active =
          l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={`nav-link${active ? " active" : ""}`}>
            <span style={{ width: 18, textAlign: "center" }}>{l.icon}</span>
            {l.label}
            {l.badge > 0 && <span className="nav-badge">{l.badge}</span>}
          </Link>
        );
      })}
    </>
  );
}
