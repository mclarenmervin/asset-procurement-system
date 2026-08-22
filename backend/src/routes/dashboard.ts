import { Router } from "express";
import { prisma } from "../db.js";
import { auth, AuthRequest } from "../middleware/auth.js";
import { assetScope, can, permit } from "../rbac.js";
export const dashboardRouter = Router();
dashboardRouter.use(auth, permit("dashboard.view"));
dashboardRouter.get("/", async (req: AuthRequest, res) => {
  const org = req.user!.organizationId;
  const now = new Date(),
    soon = new Date(Date.now() + 90 * 86400000);
  const [assets, vendors, pos, maintenance, expiring, recent] =
    await Promise.all([
      prisma.asset.count({
        where: { organizationId: org, ...assetScope(req) },
      }),
      can(req.user!.role, "vendors.view")
        ? prisma.vendor.count({ where: { organizationId: org } })
        : 0,
      !["EMPLOYEE", "DEPARTMENT_HEAD"].includes(req.user!.role)
        ? prisma.purchaseOrder.count({
            where: {
              organizationId: org,
              status: { notIn: ["CLOSED", "CANCELLED"] },
            },
          })
        : 0,
      prisma.asset.count({
        where: {
          organizationId: org,
          ...assetScope(req),
          status: "UNDER_MAINTENANCE",
        },
      }),
      prisma.asset.count({
        where: {
          organizationId: org,
          ...assetScope(req),
          OR: [
            { expiryDate: { gte: now, lte: soon } },
            { warrantyEndDate: { gte: now, lte: soon } },
          ],
        },
      }),
      prisma.assetMovement.findMany({
        where: { asset: { organizationId: org, ...assetScope(req) } },
        include: { asset: true, fromLocation: true, toLocation: true },
        take: 8,
        orderBy: { movedAt: "desc" },
      }),
    ]);
  res.json({
    assets,
    vendors,
    openPurchaseOrders: pos,
    maintenance,
    expiringSoon: expiring,
    recentMovements: recent,
  });
});
