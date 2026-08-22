"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { can, Permission, useSession } from "../lib/rbac";
const navigation = [
  ["/dashboard", "Command centre", "dashboard.view", "overview", "grid"],
  ["/reports", "Reports & analytics", "reports.view", "overview", "chart"],
  ["/assets", "Asset registry", "assets.view", "operations", "box"],
  ["/tracking", "Live GPS tracking", "tracking.view", "operations", "pin"],
  ["/procurement", "Procurement", "procurement.view", "operations", "cart"],
  [
    "/inventory",
    "Stores & inventory",
    "inventory.view",
    "operations",
    "layers",
  ],
  ["/vendors", "Vendor management", "vendors.view", "operations", "users"],
  ["/maintenance", "Maintenance", "maintenance.view", "assurance", "tool"],
  [
    "/verification",
    "Physical verification",
    "verification.view",
    "assurance",
    "check",
  ],
  [
    "/governance",
    "Audit & notifications",
    "governance.view",
    "assurance",
    "shield",
  ],
  ["/locations", "Locations", "locations.view", "administration", "building"],
  ["/master-data", "Master data", "masters.view", "administration", "settings"],
] as const;
const groups = [
  ["overview", "Overview"],
  ["operations", "Operations"],
  ["assurance", "Assurance & control"],
  ["administration", "Administration"],
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
            <span className="brandMark">AF</span>
            <span>
              AssetFlow<small>ENTERPRISE OPERATIONS</small>
            </span>
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
          {groups.map(([group, groupLabel]) => {
            const links = navigation.filter(
              ([, , permission, section]) =>
                section === group && can(user?.role, permission),
            );
            if (!links.length) return null;
            return (
              <div className="navGroup" key={group}>
                <div className="navLabel">{groupLabel}</div>
                {links.map(([href, label, , , icon]) => {
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
                      <NavIcon name={icon} />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="sideFooter">
          <span className="systemDot" />
          System operational<small>Secure enterprise workspace</small>
        </div>
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
              <div className="breadcrumb">Enterprise operations / {title}</div>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="userAccess">
            <div className="userAvatar">
              {(user?.name || "U").slice(0, 1).toUpperCase()}
            </div>
            <span>
              {user?.name || "Signed in"}
              <small>{user?.role?.replaceAll("_", " ")}</small>
            </span>
            <button
              className="iconButton logoutButton"
              aria-label="Sign out"
              title="Sign out"
              onClick={logout}
            >
              ↗
            </button>
          </div>
        </div>
        {allowed ? children : <AccessDenied />}
      </main>
    </div>
  );
}
function NavIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
      </>
    ),
    box: (
      <>
        <path d="m21 8-9 5-9-5 9-5 9 5Z" />
        <path d="m3 8 9 5 9-5v9l-9 5-9-5V8Z" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    cart: (
      <>
        <path d="M3 3h2l2.4 11.5h10.8l2-7.5H6" />
        <circle cx="9" cy="19" r="1.5" />
        <circle cx="18" cy="19" r="1.5" />
      </>
    ),
    layers: (
      <>
        <path d="m12 2 10 5-10 5L2 7l10-5Z" />
        <path d="m2 12 10 5 10-5M2 17l10 5 10-5" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <path d="M17 11a4 4 0 0 1 0-8M23 21v-2a4 4 0 0 0-3-3.9" />
      </>
    ),
    tool: (
      <path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 9.6 6 7.3 3.7a4 4 0 0 0 5 5L4 17l3 3 8.3-8.3a4 4 0 0 0 5-5L18 9l-2.4-2.4 2.3-2.3Z" />
    ),
    check: (
      <>
        <path d="M20 6 9 17l-5-5" />
        <path d="M21 12a9 9 0 1 1-5.3-8.2" />
      </>
    ),
    shield: (
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3-10 2 2 4-4" />
    ),
    building: (
      <>
        <path d="M3 22h18M6 22V4h12v18M9 8h2M13 8h2M9 12h2M13 12h2M10 22v-5h4v5" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
  };
  return (
    <svg
      className="navIcon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
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
