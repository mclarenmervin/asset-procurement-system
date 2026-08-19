import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { auth, authorize, AuthRequest } from "../middleware/auth.js";
import { audit } from "../audit.js";
import { AppError } from "../middleware/errors.js";
export const procurementRouter = Router();
procurementRouter.use(auth);
const procurement = authorize(
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "PROCUREMENT_OFFICER",
);
const approvers = authorize(
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "DEPARTMENT_HEAD",
  "FINANCE",
);
const item = z.object({
  productId: z.string().cuid(),
  quantity: z.coerce.number().int().positive(),
  estimatedUnitPrice: z.preprocess(
    (v) => (v === "" ? null : v),
    z.coerce.number().nonnegative().nullable().optional(),
  ),
  remarks: z.string().max(500).optional(),
});
const requisition = z.object({
  requisitionNumber: z.string().trim().min(2),
  title: z.string().trim().min(3),
  justification: z.string().trim().max(2000).optional(),
  neededBy: z.preprocess(
    (v) => (v === "" ? null : v),
    z.coerce.date().nullable().optional(),
  ),
  items: z.array(item).min(1),
});
procurementRouter.get("/options", async (req: AuthRequest, res) => {
  const org = req.user!.organizationId;
  const [products, vendors, requisitions, rfqs] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId: org },
      include: { category: true },
      orderBy: { name: "asc" },
    }),
    prisma.vendor.findMany({
      where: { organizationId: org },
      orderBy: { name: "asc" },
    }),
    prisma.purchaseRequisition.findMany({
      where: { organizationId: org, status: "APPROVED" },
      select: { id: true, requisitionNumber: true, title: true },
    }),
    prisma.requestForQuotation.findMany({
      where: {
        organizationId: org,
        status: { in: ["DRAFT", "OPEN", "CLOSED"] },
      },
      select: { id: true, rfqNumber: true, title: true },
    }),
  ]);
  res.json({ products, vendors, requisitions, rfqs });
});
procurementRouter.get("/requisitions", async (req: AuthRequest, res) =>
  res.json(
    await prisma.purchaseRequisition.findMany({
      where: { organizationId: req.user!.organizationId },
      include: {
        requestedBy: { select: { name: true, email: true } },
        items: { include: { product: true } },
        rfqs: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ),
);
procurementRouter.post("/requisitions", async (req: AuthRequest, res) => {
  const data = requisition.parse(req.body),
    org = req.user!.organizationId;
  await productsOwned(
    data.items.map((i) => i.productId),
    org,
  );
  const row = await prisma.purchaseRequisition.create({
    data: {
      ...withoutItems(data),
      organizationId: org,
      requestedByUserId: req.user!.id,
      items: { create: data.items },
    },
    include: { items: { include: { product: true } } },
  });
  await audit(req, "CREATE", "PurchaseRequisition", row.id, undefined, row);
  res.status(201).json(row);
});
procurementRouter.put("/requisitions/:id", async (req: AuthRequest, res) => {
  const id = String(req.params.id),
    before = await reqOwned(id, req),
    data = requisition.parse(req.body);
  if (before.status !== "DRAFT")
    throw new AppError(400, "Only draft requisitions can be edited");
  if (
    before.requestedByUserId !== req.user!.id &&
    !["SUPER_ADMIN", "ORG_ADMIN", "PROCUREMENT_OFFICER"].includes(
      req.user!.role,
    )
  )
    throw new AppError(403, "You cannot edit this requisition");
  await productsOwned(
    data.items.map((i) => i.productId),
    req.user!.organizationId,
  );
  const row = await prisma.$transaction(async (tx) => {
    await tx.requisitionItem.deleteMany({ where: { requisitionId: id } });
    return tx.purchaseRequisition.update({
      where: { id },
      data: { ...withoutItems(data), items: { create: data.items } },
      include: { items: { include: { product: true } } },
    });
  });
  await audit(req, "UPDATE", "PurchaseRequisition", id, before, row);
  res.json(row);
});
procurementRouter.delete("/requisitions/:id", async (req: AuthRequest, res) => {
  const id = String(req.params.id),
    before = await reqOwned(id, req);
  if (before.status !== "DRAFT")
    throw new AppError(400, "Only draft requisitions can be deleted");
  if (
    before.requestedByUserId !== req.user!.id &&
    !["SUPER_ADMIN", "ORG_ADMIN"].includes(req.user!.role)
  )
    throw new AppError(403, "You cannot delete this requisition");
  await prisma.purchaseRequisition.delete({ where: { id } });
  await audit(req, "DELETE", "PurchaseRequisition", id, before);
  res.status(204).end();
});
procurementRouter.post(
  "/requisitions/:id/submit",
  async (req: AuthRequest, res) => {
    const id = String(req.params.id),
      before = await reqOwned(id, req);
    if (before.status !== "DRAFT")
      throw new AppError(400, "Only draft requisitions can be submitted");
    const template = await prisma.workflowTemplate.findFirst({
      where: {
        organizationId: req.user!.organizationId,
        entityType: "PURCHASE_REQUISITION",
        active: true,
      },
      include: { steps: { orderBy: { step: "asc" }, take: 1 } },
    });
    const firstStep = template?.steps[0];
    const row = await prisma.$transaction(async (tx) => {
      await tx.approval.create({
        data: {
          entityType: "PURCHASE_REQUISITION",
          entityId: id,
          organizationId: req.user!.organizationId,
          requestedByUserId: req.user!.id,
          step: firstStep?.step || 1,
          approverRole: firstStep?.approverRole || "DEPARTMENT_HEAD",
        },
      });
      return tx.purchaseRequisition.update({
        where: { id },
        data: { status: "PENDING_APPROVAL" },
      });
    });
    await audit(req, "SUBMIT", "PurchaseRequisition", id, before, row);
    res.json(row);
  },
);
procurementRouter.post(
  "/requisitions/:id/decision",
  async (req: AuthRequest, res) => {
    const id = String(req.params.id),
      before = await reqOwned(id, req),
      data = z
        .object({
          decision: z.enum(["APPROVED", "REJECTED"]),
          comments: z.string().max(1000).optional(),
        })
        .parse(req.body);
    if (before.status !== "PENDING_APPROVAL")
      throw new AppError(400, "Requisition is not pending approval");
    const current = await prisma.approval.findFirst({
      where: {
        organizationId: req.user!.organizationId,
        entityType: "PURCHASE_REQUISITION",
        entityId: id,
        status: "PENDING",
      },
      orderBy: { step: "asc" },
    });
    if (!current) throw new AppError(400, "No pending approval step exists");
    if (
      !["SUPER_ADMIN", "ORG_ADMIN", current.approverRole].includes(
        req.user!.role as any,
      )
    )
      throw new AppError(403, `This step requires ${current.approverRole}`);
    const template = await prisma.workflowTemplate.findFirst({
      where: {
        organizationId: req.user!.organizationId,
        entityType: "PURCHASE_REQUISITION",
        active: true,
      },
      include: { steps: { orderBy: { step: "asc" } } },
    });
    const nextStep =
      data.decision === "APPROVED"
        ? template?.steps.find((step) => step.step > current.step)
        : undefined;
    const row = await prisma.$transaction(async (tx) => {
      await tx.approval.update({
        where: { id: current.id },
        data: {
          status: data.decision,
          comments: data.comments,
          actedAt: new Date(),
        },
      });
      if (nextStep)
        await tx.approval.create({
          data: {
            entityType: "PURCHASE_REQUISITION",
            entityId: id,
            organizationId: req.user!.organizationId,
            requestedByUserId: before.requestedByUserId,
            step: nextStep.step,
            approverRole: nextStep.approverRole,
          },
        });
      return tx.purchaseRequisition.update({
        where: { id },
        data: {
          status:
            data.decision === "REJECTED"
              ? "REJECTED"
              : nextStep
                ? "PENDING_APPROVAL"
                : "APPROVED",
        },
      });
    });
    await audit(req, data.decision, "PurchaseRequisition", id, before, row);
    res.json(row);
  },
);
const rfq = z.object({
  rfqNumber: z.string().trim().min(2),
  title: z.string().trim().min(3),
  closingDate: z.coerce.date(),
  requisitionId: z.string().cuid().optional(),
  status: z.enum(["DRAFT", "OPEN", "CLOSED"]).default("DRAFT"),
});
procurementRouter.get("/rfqs", async (req: AuthRequest, res) =>
  res.json(
    await prisma.requestForQuotation.findMany({
      where: { organizationId: req.user!.organizationId },
      include: {
        requisition: true,
        quotations: {
          include: { vendor: true },
          orderBy: { quotedAmount: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ),
);
procurementRouter.post("/rfqs", procurement, async (req: AuthRequest, res) => {
  const data = rfq.parse(req.body),
    org = req.user!.organizationId;
  if (data.requisitionId) {
    const r = await reqOwned(data.requisitionId, req);
    if (r.status !== "APPROVED")
      throw new AppError(400, "Only approved requisitions can become RFQs");
  }
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.requestForQuotation.create({
      data: { ...data, organizationId: org },
    });
    if (data.requisitionId)
      await tx.purchaseRequisition.update({
        where: { id: data.requisitionId },
        data: { status: "CONVERTED_TO_RFQ" },
      });
    return created;
  });
  await audit(req, "CREATE", "RFQ", row.id, undefined, row);
  res.status(201).json(row);
});
const quotation = z.object({
  quotationNumber: z.string().trim().min(2),
  rfqId: z.string().cuid(),
  vendorId: z.string().cuid(),
  quotedAmount: z.coerce.number().nonnegative(),
  deliveryDays: z.preprocess(
    (v) => (v === "" ? null : v),
    z.coerce.number().int().nonnegative().nullable().optional(),
  ),
  validityDate: z.preprocess(
    (v) => (v === "" ? null : v),
    z.coerce.date().nullable().optional(),
  ),
  notes: z.string().max(1000).optional(),
});
procurementRouter.post(
  "/quotations",
  procurement,
  async (req: AuthRequest, res) => {
    const data = quotation.parse(req.body),
      org = req.user!.organizationId;
    const [rfqRow, vendor] = await Promise.all([
      prisma.requestForQuotation.findFirst({
        where: { id: data.rfqId, organizationId: org },
      }),
      prisma.vendor.findFirst({
        where: { id: data.vendorId, organizationId: org },
      }),
    ]);
    if (!rfqRow || !vendor)
      throw new AppError(
        400,
        "RFQ or vendor does not belong to your organization",
      );
    if (!["DRAFT", "OPEN"].includes(rfqRow.status))
      throw new AppError(400, "RFQ is not accepting quotations");
    const row = await prisma.vendorQuotation.create({
      data: { ...data, organizationId: org },
    });
    await audit(req, "CREATE", "VendorQuotation", row.id, undefined, row);
    res.status(201).json(row);
  },
);
procurementRouter.post(
  "/quotations/:id/select",
  procurement,
  async (req: AuthRequest, res) => {
    const id = String(req.params.id),
      org = req.user!.organizationId,
      before = await prisma.vendorQuotation.findFirst({
        where: { id, organizationId: org },
        include: { rfq: true },
      });
    if (!before) throw new AppError(404, "Quotation not found");
    const row = await prisma.$transaction(async (tx) => {
      await tx.vendorQuotation.updateMany({
        where: { rfqId: before.rfqId },
        data: { status: "REJECTED" },
      });
      const selected = await tx.vendorQuotation.update({
        where: { id },
        data: { status: "SELECTED" },
      });
      await tx.requestForQuotation.update({
        where: { id: before.rfqId },
        data: { status: "AWARDED" },
      });
      return selected;
    });
    await audit(req, "SELECT", "VendorQuotation", id, before, row);
    res.json(row);
  },
);
const poSchema = z.object({
  poNumber: z.string().trim().min(2),
  poDate: z.coerce.date(),
  status: z
    .enum([
      "DRAFT",
      "APPROVED",
      "PARTIALLY_RECEIVED",
      "RECEIVED",
      "CLOSED",
      "CANCELLED",
    ])
    .optional(),
  totalAmount: z.coerce.number().nonnegative(),
  expectedDeliveryDate: z.preprocess(
    (v) => (v === "" ? null : v),
    z.coerce.date().nullable().optional(),
  ),
  vendorId: z.string().cuid(),
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        quantity: z.coerce.number().int().positive(),
        unitPrice: z.coerce.number().nonnegative(),
      }),
    )
    .min(1),
});
procurementRouter.get("/purchase-orders", async (req: AuthRequest, res) =>
  res.json(
    await prisma.purchaseOrder.findMany({
      where: { organizationId: req.user!.organizationId },
      include: {
        vendor: true,
        items: { include: { product: true } },
        goodsReceipts: true,
      },
      orderBy: { poDate: "desc" },
    }),
  ),
);
procurementRouter.post(
  "/purchase-orders",
  procurement,
  async (req: AuthRequest, res) => {
    const { items, ...po } = poSchema.parse(req.body),
      org = req.user!.organizationId;
    const vendor = await prisma.vendor.findFirst({
      where: { id: po.vendorId, organizationId: org },
    });
    await productsOwned(
      items.map((i) => i.productId),
      org,
    );
    if (!vendor)
      throw new AppError(400, "Vendor does not belong to your organization");
    const result = await prisma.purchaseOrder.create({
      data: { ...po, organizationId: org, items: { create: items } },
      include: { items: true },
    });
    await audit(req, "CREATE", "PurchaseOrder", result.id, undefined, result);
    res.status(201).json(result);
  },
);
procurementRouter.post(
  "/purchase-orders/:id/decision",
  approvers,
  async (req: AuthRequest, res) => {
    const id = String(req.params.id),
      org = req.user!.organizationId,
      before = await prisma.purchaseOrder.findFirst({
        where: { id, organizationId: org },
      });
    if (!before) throw new AppError(404, "Purchase order not found");
    const { decision } = z
      .object({ decision: z.enum(["APPROVED", "CANCELLED"]) })
      .parse(req.body);
    const row = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: decision },
    });
    await audit(req, decision, "PurchaseOrder", id, before, row);
    res.json(row);
  },
);
procurementRouter.get("/grns", async (req: AuthRequest, res) =>
  res.json(
    await prisma.goodsReceipt.findMany({
      where: { organizationId: req.user!.organizationId },
      include: { purchaseOrder: { include: { vendor: true } }, items: true },
      orderBy: { receiptDate: "desc" },
    }),
  ),
);
function withoutItems(data: any) {
  const { items, ...rest } = data;
  return rest;
}
async function reqOwned(id: string, req: AuthRequest) {
  const row = await prisma.purchaseRequisition.findFirst({
    where: { id, organizationId: req.user!.organizationId },
  });
  if (!row) throw new AppError(404, "Requisition not found");
  return row;
}
async function productsOwned(ids: string[], org: string) {
  const unique = [...new Set(ids)],
    count = await prisma.product.count({
      where: { id: { in: unique }, organizationId: org },
    });
  if (count !== unique.length)
    throw new AppError(
      400,
      "One or more products do not belong to your organization",
    );
}
