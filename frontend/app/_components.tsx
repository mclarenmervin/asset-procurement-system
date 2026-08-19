"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
const navigation = [
  ["/dashboard", "Dashboard"],
  ["/reports", "Reports & Analytics"],
  ["/assets", "Assets"],
  ["/vendors", "Vendors"],
  ["/procurement", "Procurement"],
  ["/inventory", "Stores & Inventory"],
  ["/maintenance", "Maintenance & Compliance"],
  ["/verification", "Physical Verification"],
  ["/governance", "Notifications & Audit"],
  ["/locations", "Locations"],
  ["/master-data", "Master Data"],
] as const;
export function Shell({
  title,
  children,
  back,
}: {
  title: string;
  children: React.ReactNode;
  back?: { href: string; label: string };
}) {
  const pathname = usePathname(),
    [menuOpen, setMenuOpen] = useState(false);
  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    location.href = "/login";
  }
  return (
    <div className="shell">
      {menuOpen && (
        <button
          className="navBackdrop"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`side ${menuOpen ? "open" : ""}`}>
        <div className="sideHead">
          <Link
            href="/dashboard"
            className="brand"
            onClick={() => setMenuOpen(false)}
          >
            AssetFlow<small>ENTERPRISE MANAGEMENT</small>
          </Link>
          <button
            className="menuClose"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          >
            ×
          </button>
        </div>
        <nav className="nav" aria-label="Main navigation">
          {navigation.map(([href, label]) => {
            const active =
              pathname === href ||
              (href !== "/dashboard" && pathname.startsWith(href + "/"));
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={active ? "active" : ""}
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="main">
        <div className="top">
          <div className="topIdentity">
            <button
              className="menuButton"
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              ☰
            </button>
            <div className="title">
              {back && (
                <Link className="pageBack" href={back.href}>
                  ← {back.label}
                </Link>
              )}
              <h1>{title}</h1>
              <div className="muted">
                Asset, procurement & material lifecycle control
              </div>
            </div>
          </div>
          <button className="btn logoutButton" onClick={logout}>
            Logout
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
