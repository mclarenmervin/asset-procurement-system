"use client";
import { useEffect, useState } from "react";
import { API, token } from "./api";

export type Role =
  | "SUPER_ADMIN"
  | "ORG_ADMIN"
  | "PROCUREMENT_OFFICER"
  | "STORE_MANAGER"
  | "DEPARTMENT_HEAD"
  | "ASSET_MANAGER"
  | "MAINTENANCE"
  | "FINANCE"
  | "AUDITOR"
  | "EMPLOYEE";
export type Permission =
  | "dashboard.view"
  | "assets.view"
  | "assets.manage"
  | "assets.delete"
  | "assets.move"
  | "documents.manage"
  | "documents.delete"
  | "vendors.view"
  | "vendors.manage"
  | "procurement.view"
  | "procurement.manage"
  | "procurement.approve"
  | "inventory.view"
  | "inventory.manage"
  | "maintenance.view"
  | "maintenance.manage"
  | "maintenance.approve"
  | "verification.view"
  | "verification.manage"
  | "governance.view"
  | "audit.view"
  | "workflows.manage"
  | "reports.view"
  | "locations.view"
  | "locations.manage"
  | "masters.view"
  | "masters.manage"
  | "users.manage";
const all: Permission[] = [
  "dashboard.view",
  "assets.view",
  "assets.manage",
  "assets.delete",
  "assets.move",
  "documents.manage",
  "documents.delete",
  "vendors.view",
  "vendors.manage",
  "procurement.view",
  "procurement.manage",
  "procurement.approve",
  "inventory.view",
  "inventory.manage",
  "maintenance.view",
  "maintenance.manage",
  "maintenance.approve",
  "verification.view",
  "verification.manage",
  "governance.view",
  "audit.view",
  "workflows.manage",
  "reports.view",
  "locations.view",
  "locations.manage",
  "masters.view",
  "masters.manage",
  "users.manage",
];
export const rolePermissions: Record<Role, Permission[]> = {
  SUPER_ADMIN: all,
  ORG_ADMIN: all,
  ASSET_MANAGER: [
    "dashboard.view",
    "assets.view",
    "assets.manage",
    "assets.delete",
    "assets.move",
    "documents.manage",
    "documents.delete",
    "vendors.view",
    "procurement.view",
    "inventory.view",
    "maintenance.view",
    "maintenance.manage",
    "maintenance.approve",
    "verification.view",
    "verification.manage",
    "governance.view",
    "reports.view",
    "locations.view",
    "locations.manage",
    "masters.view",
    "masters.manage",
  ],
  PROCUREMENT_OFFICER: [
    "dashboard.view",
    "assets.view",
    "vendors.view",
    "vendors.manage",
    "procurement.view",
    "procurement.manage",
    "governance.view",
    "reports.view",
    "locations.view",
    "masters.view",
    "masters.manage",
  ],
  STORE_MANAGER: [
    "dashboard.view",
    "assets.view",
    "assets.manage",
    "assets.move",
    "documents.manage",
    "vendors.view",
    "procurement.view",
    "inventory.view",
    "inventory.manage",
    "verification.view",
    "verification.manage",
    "governance.view",
    "reports.view",
    "locations.view",
    "locations.manage",
    "masters.view",
  ],
  DEPARTMENT_HEAD: [
    "dashboard.view",
    "assets.view",
    "vendors.view",
    "procurement.view",
    "procurement.approve",
    "governance.view",
    "locations.view",
  ],
  MAINTENANCE: [
    "dashboard.view",
    "assets.view",
    "assets.move",
    "documents.manage",
    "maintenance.view",
    "maintenance.manage",
    "governance.view",
    "locations.view",
  ],
  FINANCE: [
    "dashboard.view",
    "assets.view",
    "vendors.view",
    "procurement.view",
    "procurement.approve",
    "inventory.view",
    "maintenance.view",
    "maintenance.approve",
    "governance.view",
    "reports.view",
    "locations.view",
  ],
  AUDITOR: [
    "dashboard.view",
    "assets.view",
    "vendors.view",
    "procurement.view",
    "inventory.view",
    "maintenance.view",
    "verification.view",
    "verification.manage",
    "governance.view",
    "audit.view",
    "reports.view",
    "locations.view",
    "masters.view",
  ],
  EMPLOYEE: [
    "dashboard.view",
    "assets.view",
    "procurement.view",
    "locations.view",
  ],
};
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  organization?: string;
};
export function can(role: string | undefined, permission: Permission) {
  return !!role && (rolePermissions[role as Role] || []).includes(permission);
}
export function sessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}
let sessionRefresh: Promise<SessionUser | null> | null = null;
function refreshSession() {
  if (!sessionRefresh)
    sessionRefresh = fetch(API + "/auth/me", {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const user = await response.json();
        localStorage.setItem("user", JSON.stringify(user));
        return user;
      })
      .catch(() => sessionUser());
  return sessionRefresh;
}
export function useSession() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  useEffect(() => {
    setUser(sessionUser());
    refreshSession().then(setUser);
  }, []);
  return user;
}
export function usePermission(permission: Permission) {
  const user = useSession();
  return user === undefined ? undefined : can(user?.role, permission);
}
