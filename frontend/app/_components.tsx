"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { can, Permission, useSession } from "../lib/rbac";
const navigation = [
  ["/dashboard", "Dashboard", "dashboard.view"],
  ["/reports", "Reports & Analytics", "reports.view"],
  ["/assets", "Assets", "assets.view"],
  ["/vendors", "Vendors", "vendors.view"],
  ["/procurement", "Procurement", "procurement.view"],
  ["/inventory", "Stores & Inventory", "inventory.view"],
  ["/maintenance", "Maintenance & Compliance", "maintenance.view"],
  ["/verification", "Physical Verification", "verification.view"],
  ["/governance", "Notifications & Audit", "governance.view"],
  ["/locations", "Locations", "locations.view"],
  ["/master-data", "Master Data", "masters.view"],
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
    user = useSession(),
    [menuOpen, setMenuOpen] = useState(false);
  const pagePermission = navigation.find(
    ([href]) =>
      pathname === href ||
      (href !== "/dashboard" && pathname.startsWith(href + "/")),
  )?.[2] as Permission | undefined;
  const allowed =
    !pagePermission || user === undefined || can(user?.role, pagePermission);
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
          {navigation
            .filter(([, , permission]) => can(user?.role, permission))
            .map(([href, label]) => {
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
          <div className="userAccess">
            <span>
              {user?.name || "Signed in"}
              <small>{user?.role?.replaceAll("_", " ")}</small>
            </span>
            <button className="btn logoutButton" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
        {allowed ? children : <AccessDenied />}
      </main>
    </div>
  );
}
function AccessDenied() {
  return (
    <section className="card section accessDenied">
      <span>403</span>
      <h2>Access restricted</h2>
      <p className="muted">
        Your role does not have permission to open this module.
      </p>
      <Link className="btn" href="/dashboard">
        Return to dashboard
      </Link>
    </section>
  );
}
