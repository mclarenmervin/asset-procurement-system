import { Router, Response } from "express";
import { prisma } from "../db.js";
import { auth, AuthRequest } from "../middleware/auth.js";
export const reportsRouter = Router();
reportsRouter.use(auth);
reportsRouter.get("/analytics", async (req: AuthRequest, res) => {
  const org = req.user!.organizationId,
    now = new Date(),
    soon = new Date(Date.now() + 60 * 86400000);
  const [
    assetCount,
    assetValue,
    assetStatus,
    categoryGroups,
    locationGroups,
    poStatus,
    vendorSpend,
    batches,
    maintenance,
    compliance,
    verification,
  ] = await Promise.all([
    prisma.asset.count({ where: { organizationId: org } }),
    prisma.asset.aggregate({
      where: { organizationId: org },
      _sum: { purchasePrice: true },
    }),
    prisma.asset.groupBy({
      by: ["status"],
      where: { organizationId: org },
      _count: true,
    }),
    prisma.asset.groupBy({
      by: ["categoryId"],
      where: { organizationId: org },
      _count: true,
      _sum: { purchasePrice: true },
    }),
    prisma.asset.groupBy({
      by: ["currentLocationId"],
      where: { organizationId: org },
      _count: true,
    }),
    prisma.purchaseOrder.groupBy({
      by: ["status"],
      where: { organizationId: org },
      _count: true,
      _sum: { totalAmount: true },
    }),
    prisma.purchaseOrder.groupBy({
      by: ["vendorId"],
      where: { organizationId: org, status: { not: "CANCELLED" } },
      _count: true,
      _sum: { totalAmount: true },
    }),
    prisma.materialBatch.groupBy({
      by: ["productId"],
      where: { organizationId: org },
      _sum: { quantity: true },
    }),
    prisma.maintenanceRecord.groupBy({
      by: ["type"],
      where: { asset: { organizationId: org } },
      _count: true,
      _sum: { cost: true },
    }),
    prisma.complianceRecord.groupBy({
      by: ["type"],
      where: {
        organizationId: org,
        dueDate: { lte: soon },
        completedDate: null,
      },
      _count: true,
    }),
    prisma.verificationRecord.groupBy({
      by: ["result"],
      where: { session: { organizationId: org } },
      _count: true,
    }),
  ]);
  const [categories, locations, vendors, products] = await Promise.all([
    prisma.assetCategory.findMany({
      where: { id: { in: categoryGroups.map((x) => x.categoryId) } },
      select: { id: true, name: true },
    }),
    prisma.location.findMany({
      where: {
        id: {
          in: locationGroups.flatMap((x) =>
            x.currentLocationId ? [x.currentLocationId] : [],
          ),
        },
      },
      select: { id: true, name: true },
    }),
    prisma.vendor.findMany({
      where: { id: { in: vendorSpend.map((x) => x.vendorId) } },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { id: { in: batches.map((x) => x.productId) } },
      select: { id: true, name: true, sku: true },
    }),
  ]);
  const map = (rows: any[]) => new Map(rows.map((x) => [x.id, x]));
  const cm = map(categories),
    lm = map(locations),
    vm = map(vendors),
    pm = map(products);
  res.json({
    summary: {
      assetCount,
      assetValue: Number(assetValue._sum.purchasePrice || 0),
      openPurchaseOrders: poStatus
        .filter((x) => !["CLOSED", "CANCELLED", "RECEIVED"].includes(x.status))
        .reduce((n, x) => n + x._count, 0),
      stockUnits: batches.reduce((n, x) => n + (x._sum.quantity || 0), 0),
      maintenanceCost: maintenance.reduce(
        (n, x) => n + Number(x._sum.cost || 0),
        0,
      ),
      dueCompliance: compliance.reduce((n, x) => n + x._count, 0),
    },
    assetsByStatus: assetStatus.map((x) => ({
      label: x.status,
      value: x._count,
    })),
    assetsByCategory: categoryGroups.map((x) => ({
      label: cm.get(x.categoryId)?.name || "Unknown",
      value: x._count,
      amount: Number(x._sum.purchasePrice || 0),
    })),
    assetsByLocation: locationGroups.map((x) => ({
      label: x.currentLocationId
        ? lm.get(x.currentLocationId)?.name || "Unknown"
        : "Unassigned",
      value: x._count,
    })),
    purchaseOrders: poStatus.map((x) => ({
      label: x.status,
      value: x._count,
      amount: Number(x._sum.totalAmount || 0),
    })),
    vendorSpend: vendorSpend
      .map((x) => ({
        label: vm.get(x.vendorId)?.name || "Unknown",
        value: Number(x._sum.totalAmount || 0),
        orders: x._count,
      }))
      .sort((a, b) => b.value - a.value),
    stockByProduct: batches
      .map((x) => ({
        label: pm.get(x.productId)?.name || "Unknown",
        sku: pm.get(x.productId)?.sku,
        value: x._sum.quantity || 0,
      }))
      .sort((a, b) => b.value - a.value),
    maintenance: maintenance.map((x) => ({
      label: x.type,
      value: x._count,
      cost: Number(x._sum.cost || 0),
    })),
    compliance: compliance.map((x) => ({ label: x.type, value: x._count })),
    verification: verification.map((x) => ({
      label: x.result,
      value: x._count,
    })),
    generatedAt: now,
  });
});
reportsRouter.get("/export/:type", async (req: AuthRequest, res) => {
  const org = req.user!.organizationId,
    type = String(req.params.type);
  if (type === "assets") {
    const rows = await prisma.asset.findMany({
      where: { organizationId: org },
      include: {
        product: true,
        category: true,
        vendor: true,
        department: true,
        currentLocation: true,
        custodian: true,
        purchaseOrder: true,
      },
      orderBy: { assetTag: "asc" },
    });
    return csv(
      res,
      "asset-register.csv",
      [
        "Asset Tag",
        "Serial",
        "Product",
        "Category",
        "Tags",
        "Status",
        "Vendor",
        "Department",
        "Location",
        "Custodian",
        "Purchase Order",
        "Purchase Price",
        "Purchase Date",
        "Commissioning Date",
        "Warranty End",
        "Expiry",
        "Notes",
      ],
      rows.map((a) => [
        a.assetTag,
        a.serialNumber,
        a.product.name,
        a.category.name,
        a.tags.join("; "),
        a.status,
        a.vendor?.name,
        a.department?.name,
        a.currentLocation?.name,
        a.custodian?.email,
        a.purchaseOrder?.poNumber,
        a.purchasePrice,
        a.purchaseDate,
        a.commissioningDate,
        a.warrantyEndDate,
        a.expiryDate,
        a.notes,
      ]),
    );
  }
  if (type === "movements") {
    const rows = await prisma.assetMovement.findMany({
      where: { asset: { organizationId: org } },
      include: { asset: true, fromLocation: true, toLocation: true },
      orderBy: { movedAt: "desc" },
    });
    return csv(
      res,
      "asset-movements.csv",
      ["Asset Tag", "Type", "From", "To", "Date", "Remarks"],
      rows.map((x) => [
        x.asset.assetTag,
        x.type,
        x.fromLocation?.name,
        x.toLocation?.name,
        x.movedAt,
        x.remarks,
      ]),
    );
  }
  if (type === "procurement") {
    const rows = await prisma.purchaseOrder.findMany({
      where: { organizationId: org },
      include: { vendor: true, items: { include: { product: true } } },
      orderBy: { poDate: "desc" },
    });
    return csv(
      res,
      "purchase-orders.csv",
      ["PO Number", "Date", "Vendor", "Status", "Total", "Items"],
      rows.map((x) => [
        x.poNumber,
        x.poDate,
        x.vendor.name,
        x.status,
        x.totalAmount,
        x.items.map((i) => `${i.product.name} x ${i.quantity}`).join("; "),
      ]),
    );
  }
  if (type === "stock") {
    const rows = await prisma.materialBatch.findMany({
      where: { organizationId: org },
      include: { product: true, warehouse: true, bin: true },
      orderBy: { updatedAt: "desc" },
    });
    return csv(
      res,
      "stock-register.csv",
      ["SKU", "Material", "Batch", "Warehouse", "Bin", "Quantity", "Expiry"],
      rows.map((x) => [
        x.product.sku,
        x.product.name,
        x.batchNumber,
        x.warehouse.name,
        x.bin?.code,
        x.quantity,
        x.expiryDate,
      ]),
    );
  }
  if (type === "maintenance") {
    const rows = await prisma.maintenanceRecord.findMany({
      where: { asset: { organizationId: org } },
      include: { asset: true },
      orderBy: { startedAt: "desc" },
    });
    return csv(
      res,
      "maintenance-register.csv",
      [
        "Ticket",
        "Asset",
        "Type",
        "Status",
        "Priority",
        "Vendor",
        "Cost",
        "Started",
        "Completed",
        "Next Due",
      ],
      rows.map((x) => [
        x.ticketNumber,
        x.asset.assetTag,
        x.type,
        x.status,
        x.priority,
        x.vendorName,
        x.cost,
        x.startedAt,
        x.completedAt,
        x.nextDueDate,
      ]),
    );
  }
  if (type === "verification") {
    const rows = await prisma.verificationRecord.findMany({
      where: { session: { organizationId: org } },
      include: { session: true, asset: true, observedLocation: true },
      orderBy: { scannedAt: "desc" },
    });
    return csv(
      res,
      "verification-results.csv",
      [
        "Session",
        "Asset",
        "Result",
        "Observed Location",
        "Latitude",
        "Longitude",
        "Scanned At",
        "Notes",
      ],
      rows.map((x) => [
        x.session.sessionNumber,
        x.asset.assetTag,
        x.result,
        x.observedLocation?.name,
        x.latitude,
        x.longitude,
        x.scannedAt,
        x.notes,
      ]),
    );
  }
  res.status(404).json({ message: "Unknown export type" });
});
function csv(res: Response, name: string, headers: string[], rows: any[][]) {
  const escape = (v: any) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const output = [
    headers.map(escape).join(","),
    ...rows.map((row) =>
      row.map((v) => escape(v instanceof Date ? v.toISOString() : v)).join(","),
    ),
  ].join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.send("\uFEFF" + output);
}
