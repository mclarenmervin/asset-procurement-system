import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { auth, AuthRequest } from "../middleware/auth.js";
import { audit } from "../audit.js";
import { AppError } from "../middleware/errors.js";
import { permit } from "../rbac.js";
export const inventoryRouter = Router();
inventoryRouter.use(auth, permit("inventory.view"));
const stores = permit("inventory.manage");
const warehouse = z.object({
  name: z.string().trim().min(2),
  code: z.string().trim().min(1),
  locationId: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().cuid().nullable().optional(),
  ),
});
inventoryRouter.get("/warehouses", async (req: AuthRequest, res) =>
  res.json(
    await prisma.warehouse.findMany({
      where: { organizationId: req.user!.organizationId },
      include: { location: true, bins: true },
      orderBy: { name: "asc" },
    }),
  ),
);
inventoryRouter.post("/warehouses", stores, async (req: AuthRequest, res) => {
  const d = warehouse.parse(req.body),
    org = req.user!.organizationId;
  if (
    d.locationId &&
    !(await prisma.location.findFirst({
      where: { id: d.locationId, organizationId: org },
    }))
  )
    throw new AppError(400, "Location does not belong to your organization");
  const row = await prisma.warehouse.create({
    data: { ...d, code: d.code.toUpperCase(), organizationId: org },
  });
  await audit(req, "CREATE", "Warehouse", row.id, undefined, row);
  res.status(201).json(row);
});
inventoryRouter.put(
  "/warehouses/:id",
  stores,
  async (req: AuthRequest, res) => {
    const id = String(req.params.id),
      before = await wh(id, req),
      d = warehouse.parse(req.body);
    if (
      d.locationId &&
      !(await prisma.location.findFirst({
        where: { id: d.locationId, organizationId: req.user!.organizationId },
      }))
    )
      throw new AppError(400, "Location does not belong to your organization");
    const row = await prisma.warehouse.update({
      where: { id },
      data: { ...d, code: d.code.toUpperCase() },
    });
    await audit(req, "UPDATE", "Warehouse", id, before, row);
    res.json(row);
  },
);
inventoryRouter.delete(
  "/warehouses/:id",
  stores,
  async (req: AuthRequest, res) => {
    const id = String(req.params.id),
      before = await wh(id, req);
    await prisma.warehouse.delete({ where: { id } });
    await audit(req, "DELETE", "Warehouse", id, before);
    res.status(204).end();
  },
);
inventoryRouter.post(
  "/warehouses/:id/bins",
  stores,
  async (req: AuthRequest, res) => {
    const warehouseId = String(req.params.id);
    await wh(warehouseId, req);
    const d = z
      .object({
        name: z.string().trim().min(1),
        code: z.string().trim().min(1),
      })
      .parse(req.body);
    const row = await prisma.storageBin.create({
      data: { ...d, code: d.code.toUpperCase(), warehouseId },
    });
    await audit(req, "CREATE", "StorageBin", row.id, undefined, row);
    res.status(201).json(row);
  },
);
inventoryRouter.get("/options", async (req: AuthRequest, res) => {
  const org = req.user!.organizationId;
  const [products, warehouses, purchaseOrders, batches] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId: org },
      orderBy: { name: "asc" },
    }),
    prisma.warehouse.findMany({
      where: { organizationId: org },
      include: { bins: true },
      orderBy: { name: "asc" },
    }),
    prisma.purchaseOrder.findMany({
      where: {
        organizationId: org,
        status: { in: ["APPROVED", "PARTIALLY_RECEIVED"] },
      },
      include: { vendor: true, items: { include: { product: true } } },
      orderBy: { poDate: "desc" },
    }),
    prisma.materialBatch.findMany({
      where: { organizationId: org, quantity: { gt: 0 } },
      include: { product: true, warehouse: true, bin: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  res.json({ products, warehouses, purchaseOrders, batches });
});
const grn = z.object({
  grnNumber: z.string().trim().min(2),
  purchaseOrderId: z.string().cuid(),
  warehouseId: z.string().cuid(),
  invoiceNumber: z.string().trim().optional(),
  receiptDate: z.coerce.date(),
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        receivedQty: z.coerce.number().int().positive(),
        batchNumber: z.string().trim().min(1),
        binId: z.preprocess(
          (v) => (v === "" ? null : v),
          z.string().cuid().nullable().optional(),
        ),
        expiryDate: z.preprocess(
          (v) => (v === "" ? null : v),
          z.coerce.date().nullable().optional(),
        ),
        remarks: z.string().max(500).optional(),
      }),
    )
    .min(1),
});
inventoryRouter.get("/grns", async (req: AuthRequest, res) =>
  res.json(
    await prisma.goodsReceipt.findMany({
      where: { organizationId: req.user!.organizationId },
      include: {
        warehouse: true,
        purchaseOrder: { include: { vendor: true } },
        items: { include: { product: true, bin: true } },
      },
      orderBy: { receiptDate: "desc" },
    }),
  ),
);
inventoryRouter.post("/grns", stores, async (req: AuthRequest, res) => {
  const { items, ...d } = grn.parse(req.body),
    org = req.user!.organizationId;
  const [po, w] = await Promise.all([
    prisma.purchaseOrder.findFirst({
      where: { id: d.purchaseOrderId, organizationId: org },
    }),
    prisma.warehouse.findFirst({
      where: { id: d.warehouseId, organizationId: org },
    }),
  ]);
  if (!po || !w)
    throw new AppError(
      400,
      "Purchase order or warehouse does not belong to your organization",
    );
  const products = await prisma.product.count({
    where: {
      id: { in: [...new Set(items.map((i) => i.productId))] },
      organizationId: org,
    },
  });
  if (products !== new Set(items.map((i) => i.productId)).size)
    throw new AppError(400, "Invalid product");
  const binIds = [...new Set(items.flatMap((i) => (i.binId ? [i.binId] : [])))];
  const bins = await prisma.storageBin.count({
    where: { id: { in: binIds }, warehouseId: d.warehouseId },
  });
  if (bins !== binIds.length)
    throw new AppError(400, "A selected bin does not belong to this warehouse");
  const row = await prisma.goodsReceipt.create({
    data: {
      ...d,
      organizationId: org,
      status: "INSPECTION_PENDING",
      items: {
        create: items.map((i) => ({ ...i, productName: "Received product" })),
      },
    },
    include: { items: true },
  });
  await audit(req, "CREATE", "GoodsReceipt", row.id, undefined, row);
  res.status(201).json(row);
});
const inspection = z.object({
  items: z
    .array(
      z.object({
        id: z.string().cuid(),
        acceptedQty: z.coerce.number().int().nonnegative(),
        rejectedQty: z.coerce.number().int().nonnegative(),
        remarks: z.string().max(500).optional(),
      }),
    )
    .min(1),
});
inventoryRouter.post(
  "/grns/:id/inspect",
  stores,
  async (req: AuthRequest, res) => {
    const id = String(req.params.id),
      org = req.user!.organizationId,
      before = await prisma.goodsReceipt.findFirst({
        where: { id, organizationId: org },
        include: { items: true },
      });
    if (!before) throw new AppError(404, "GRN not found");
    if (before.status !== "INSPECTION_PENDING")
      throw new AppError(400, "GRN has already been inspected");
    if (!before.warehouseId) throw new AppError(400, "GRN has no warehouse");
    const data = inspection.parse(req.body);
    const decisions = new Map(data.items.map((i) => [i.id, i]));
    for (const item of before.items) {
      const d = decisions.get(item.id);
      if (!d || d.acceptedQty + d.rejectedQty !== item.receivedQty)
        throw new AppError(
          400,
          "Accepted and rejected quantities must equal received quantity",
        );
    }
    const row = await prisma.$transaction(async (tx) => {
      for (const item of before.items) {
        const d = decisions.get(item.id)!;
        await tx.goodsReceiptItem.update({
          where: { id: item.id },
          data: {
            acceptedQty: d.acceptedQty,
            rejectedQty: d.rejectedQty,
            remarks: d.remarks,
          },
        });
        if (d.acceptedQty && item.productId) {
          const batch = await tx.materialBatch.upsert({
            where: {
              organizationId_warehouseId_productId_batchNumber: {
                organizationId: org,
                warehouseId: before.warehouseId!,
                productId: item.productId,
                batchNumber: item.batchNumber || before.grnNumber,
              },
            },
            update: {
              quantity: { increment: d.acceptedQty },
              expiryDate: item.expiryDate,
              binId: item.binId,
            },
            create: {
              organizationId: org,
              warehouseId: before.warehouseId!,
              productId: item.productId,
              batchNumber: item.batchNumber || before.grnNumber,
              quantity: d.acceptedQty,
              expiryDate: item.expiryDate,
              binId: item.binId,
            },
          });
          await tx.stockTransaction.create({
            data: {
              type: "GRN_RECEIPT",
              quantity: d.acceptedQty,
              balanceAfter: batch.quantity,
              referenceType: "GRN",
              referenceId: id,
              organizationId: org,
              productId: item.productId,
              warehouseId: before.warehouseId!,
              binId: item.binId,
              batchId: batch.id,
              performedByUserId: req.user!.id,
              remarks: d.remarks,
            },
          });
        }
      }
      const accepted = data.items.reduce((n, i) => n + i.acceptedQty, 0),
        rejected = data.items.reduce((n, i) => n + i.rejectedQty, 0);
      await tx.purchaseOrder.update({
        where: { id: before.purchaseOrderId },
        data: { status: rejected ? "PARTIALLY_RECEIVED" : "RECEIVED" },
      });
      return tx.goodsReceipt.update({
        where: { id },
        data: {
          status: rejected
            ? accepted
              ? "PARTIALLY_ACCEPTED"
              : "REJECTED"
            : "ACCEPTED",
        },
        include: { items: true },
      });
    });
    await audit(req, "INSPECT", "GoodsReceipt", id, before, row);
    res.json(row);
  },
);
inventoryRouter.get("/batches", async (req: AuthRequest, res) =>
  res.json(
    await prisma.materialBatch.findMany({
      where: { organizationId: req.user!.organizationId },
      include: { product: true, warehouse: true, bin: true },
      orderBy: { updatedAt: "desc" },
    }),
  ),
);
inventoryRouter.get("/ledger", async (req: AuthRequest, res) =>
  res.json(
    await prisma.stockTransaction.findMany({
      where: { organizationId: req.user!.organizationId },
      include: { product: true, warehouse: true, batch: true },
      take: 200,
      orderBy: { createdAt: "desc" },
    }),
  ),
);
const note = z.object({
  noteNumber: z.string().trim().min(2),
  type: z.enum(["ISSUE", "RETURN"]),
  warehouseId: z.string().cuid(),
  recipient: z.string().trim().optional(),
  remarks: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        batchId: z.string().cuid(),
        quantity: z.coerce.number().int().positive(),
      }),
    )
    .min(1),
});
inventoryRouter.get("/notes", async (req: AuthRequest, res) =>
  res.json(
    await prisma.stockNote.findMany({
      where: { organizationId: req.user!.organizationId },
      include: {
        warehouse: true,
        items: { include: { product: true, batch: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ),
);
inventoryRouter.post("/notes", stores, async (req: AuthRequest, res) => {
  const { items, ...d } = note.parse(req.body),
    org = req.user!.organizationId;
  await wh(d.warehouseId, req);
  for (const i of items) {
    const b = await prisma.materialBatch.findFirst({
      where: {
        id: i.batchId,
        productId: i.productId,
        warehouseId: d.warehouseId,
        organizationId: org,
      },
    });
    if (!b) throw new AppError(400, "Invalid batch selection");
  }
  const row = await prisma.stockNote.create({
    data: { ...d, organizationId: org, items: { create: items } },
    include: { items: true },
  });
  await audit(req, "CREATE", "StockNote", row.id, undefined, row);
  res.status(201).json(row);
});
inventoryRouter.post(
  "/notes/:id/post",
  stores,
  async (req: AuthRequest, res) => {
    const id = String(req.params.id),
      org = req.user!.organizationId,
      before = await prisma.stockNote.findFirst({
        where: { id, organizationId: org },
        include: { items: true },
      });
    if (!before) throw new AppError(404, "Stock note not found");
    if (before.status !== "DRAFT")
      throw new AppError(400, "Only draft notes can be posted");
    const row = await prisma.$transaction(async (tx) => {
      for (const item of before.items) {
        const batch = await tx.materialBatch.findUnique({
          where: { id: item.batchId! },
        });
        if (!batch) throw new AppError(400, "Batch not found");
        const delta = before.type === "ISSUE" ? -item.quantity : item.quantity;
        if (batch.quantity + delta < 0)
          throw new AppError(400, "Insufficient stock for this issue");
        const updated = await tx.materialBatch.update({
          where: { id: batch.id },
          data: { quantity: { increment: delta } },
        });
        await tx.stockTransaction.create({
          data: {
            type: before.type,
            quantity: delta,
            balanceAfter: updated.quantity,
            referenceType: "STOCK_NOTE",
            referenceId: id,
            organizationId: org,
            productId: item.productId,
            warehouseId: before.warehouseId,
            batchId: batch.id,
            performedByUserId: req.user!.id,
            remarks: before.remarks,
          },
        });
      }
      return tx.stockNote.update({
        where: { id },
        data: { status: "POSTED", postedAt: new Date() },
      });
    });
    await audit(req, "POST", "StockNote", id, before, row);
    res.json(row);
  },
);
async function wh(id: string, req: AuthRequest) {
  const row = await prisma.warehouse.findFirst({
    where: { id, organizationId: req.user!.organizationId },
  });
  if (!row) throw new AppError(404, "Warehouse not found");
  return row;
}
