"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Overview", icon: "▦" },
  { href: "/drivers", label: "Drivers", icon: "👤" },
  { href: "/feedback", label: "Negative Feedback", icon: "⚠" },
  { href: "/concessions", label: "Concessions", icon: "↺" },
  { href: "/rts", label: "Return to Station", icon: "⇄" },
  { href: "/coaching", label: "Coaching Reports", icon: "✎" },
];

export default function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {links.map((l) => {
        const active =
          l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={`nav-link${active ? " active" : ""}`}>
            <span style={{ width: 18, textAlign: "center" }}>{l.icon}</span>
            {l.label}
          </Link>
        );
      })}
    </>
  );
}
