import { NextFunction, Response } from "express";
import { AuthRequest } from "./middleware/auth.js";

export const roles = [
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "PROCUREMENT_OFFICER",
  "STORE_MANAGER",
  "DEPARTMENT_HEAD",
  "ASSET_MANAGER",
  "MAINTENANCE",
  "FINANCE",
  "AUDITOR",
  "EMPLOYEE",
] as const;
export type Role = (typeof roles)[number];

export const permissions = [
  "dashboard.view",
  "assets.view",
  "assets.manage",
  "assets.delete",
  "assets.move",
  "documents.manage",
  "documents.delete",
  "tracking.view",
  "tracking.manage",
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
] as const;
export type Permission = (typeof permissions)[number];

const all = [...permissions];
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
    "tracking.view",
    "tracking.manage",
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
    "tracking.view",
    "tracking.manage",
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
    "tracking.view",
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
    "tracking.view",
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

export function can(role: string, permission: Permission) {
  return (rolePermissions[role as Role] || []).includes(permission);
}

export function permit(permission: Permission) {
  return (req: AuthRequest, res: Response, next: NextFunction) =>
    can(req.user!.role, permission)
      ? next()
      : res.status(403).json({
          message: "You do not have permission to access this module",
        });
}

export function assetScope(req: AuthRequest) {
  if (req.user!.role === "DEPARTMENT_HEAD")
    return { departmentId: req.user!.departmentId || "__NO_DEPARTMENT__" };
  if (req.user!.role === "EMPLOYEE")
    return {
      OR: [
        { custodianId: req.user!.id },
        { departmentId: req.user!.departmentId || "__NO_DEPARTMENT__" },
      ],
    };
  return {};
}
