"use client";
// Link that highlights itself when its section is the current page.
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({ href, exact = false, className, activeClassName, children }: { href: string; exact?: boolean; className: string; activeClassName: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`${className} ${active ? activeClassName : ""}`}>
      {children}
    </Link>
  );
}
