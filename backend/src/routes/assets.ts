import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { auth, authorize, AuthRequest } from "../middleware/auth.js";
import { audit } from "../audit.js";
import { AppError } from "../middleware/errors.js";
export const assetsRouter = Router();
assetsRouter.use(auth);
assetsRouter.get("/", async (req: AuthRequest, res) => {
  const q = String(req.query.q || "");
  const rows = await prisma.asset.findMany({
    where: {
      organizationId: req.user!.organizationId,
      OR: q
        ? [
            { assetTag: { contains: q, mode: "insensitive" } },
            { serialNumber: { contains: q, mode: "insensitive" } },
            { product: { name: { contains: q, mode: "insensitive" } } },
          ]
        : undefined,
    },
    include: {
      product: true,
      vendor: true,
      currentLocation: true,
      department: true,
      category: true,
      custodian: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(rows);
});
assetsRouter.get("/options/all", async (req: AuthRequest, res) => {
  const org = req.user!.organizationId;
  const [
    products,
    categories,
    vendors,
    departments,
    locations,
    users,
    purchaseOrders,
  ] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId: org },
      orderBy: { name: "asc" },
    }),
    prisma.assetCategory.findMany({
      where: { organizationId: org },
      orderBy: { name: "asc" },
    }),
    prisma.vendor.findMany({
      where: { organizationId: org },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where: { organizationId: org },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({
      where: { organizationId: org },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { organizationId: org },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.purchaseOrder.findMany({
      where: { organizationId: org },
      select: { id: true, poNumber: true },
      orderBy: { poDate: "desc" },
    }),
  ]);
  res.json({
    products,
    categories,
    vendors,
    departments,
    locations,
    users,
    purchaseOrders,
  });
});
assetsRouter.get("/:id", async (req: AuthRequest, res) => {
  const row = await prisma.asset.findFirst({
    where: {
      id: String(req.params.id),
      organizationId: req.user!.organizationId,
    },
    include: {
      product: true,
      category: true,
      vendor: true,
      currentLocation: true,
      department: true,
      custodian: { select: { id: true, name: true, email: true } },
      purchaseOrder: true,
      movements: {
        include: { fromLocation: true, toLocation: true },
        orderBy: { movedAt: "desc" },
      },
      assignments: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { assignedAt: "desc" },
      },
      maintenance: { orderBy: { startedAt: "desc" } },
      complianceRecords: { orderBy: { dueDate: "desc" } },
      disposal: true,
      documents: true,
    },
  });
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(row);
});
const optionalDate = z.preprocess(
  (v) => (v === "" ? null : v),
  z.coerce.date().nullable().optional(),
);
const optionalId = z.preprocess(
  (v) => (v === "" ? null : v),
  z.string().cuid().nullable().optional(),
);
const assetSchema = z.object({
  assetTag: z.string().trim().min(2),
  serialNumber: z.string().trim().optional(),
  qrValue: z.string().trim().optional(),
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(20)
    .default([])
    .transform((values) => [
      ...new Set(values.map((value) => value.toLowerCase())),
    ]),
  status: z
    .enum([
      "IN_STOCK",
      "IN_USE",
      "UNDER_MAINTENANCE",
      "TRANSFER_PENDING",
      "EXPIRED",
      "DISPOSED",
      "LOST",
    ])
    .optional(),
  purchasePrice: z.preprocess(
    (v) => (v === "" ? null : v),
    z.coerce.number().nonnegative().nullable().optional(),
  ),
  purchaseDate: optionalDate,
  commissioningDate: optionalDate,
  warrantyEndDate: optionalDate,
  expiryDate: optionalDate,
  notes: z.string().max(2000).optional(),
  productId: z.string().cuid(),
  categoryId: z.string().cuid(),
  vendorId: optionalId,
  purchaseOrderId: optionalId,
  departmentId: optionalId,
  currentLocationId: optionalId,
  custodianId: optionalId,
});
const importRowSchema = z.object({
  assetTag: z.string().trim().min(2),
  serialNumber: z.string().trim().optional().default(""),
  product: z.string().trim().min(1),
  category: z.string().trim().min(1),
  tags: z.string().optional().default(""),
  status: z
    .enum([
      "IN_STOCK",
      "IN_USE",
      "UNDER_MAINTENANCE",
      "TRANSFER_PENDING",
      "EXPIRED",
      "DISPOSED",
      "LOST",
    ])
    .default("IN_STOCK"),
  vendor: z.string().trim().optional().default(""),
  department: z.string().trim().optional().default(""),
  location: z.string().trim().optional().default(""),
  custodian: z.string().trim().optional().default(""),
  purchaseOrder: z.string().trim().optional().default(""),
  purchasePrice: z.union([z.string(), z.number()]).optional().default(""),
  purchaseDate: z.string().trim().optional().default(""),
  commissioningDate: z.string().trim().optional().default(""),
  warrantyEndDate: z.string().trim().optional().default(""),
  expiryDate: z.string().trim().optional().default(""),
  notes: z.string().max(2000).optional().default(""),
});
const importSchema = z.object({
  rows: z.array(importRowSchema).min(1).max(500),
});

assetsRouter.post(
  "/import",
  authorize("SUPER_ADMIN", "ORG_ADMIN", "ASSET_MANAGER", "STORE_MANAGER"),
  async (req: AuthRequest, res) => {
    const { rows } = importSchema.parse(req.body),
      org = req.user!.organizationId;
    const [
      products,
      categories,
      vendors,
      departments,
      locations,
      users,
      purchaseOrders,
      existing,
    ] = await Promise.all([
      prisma.product.findMany({ where: { organizationId: org } }),
      prisma.assetCategory.findMany({ where: { organizationId: org } }),
      prisma.vendor.findMany({ where: { organizationId: org } }),
      prisma.department.findMany({ where: { organizationId: org } }),
      prisma.location.findMany({ where: { organizationId: org } }),
      prisma.user.findMany({ where: { organizationId: org } }),
      prisma.purchaseOrder.findMany({ where: { organizationId: org } }),
      prisma.asset.findMany({
        where: { organizationId: org },
        select: { assetTag: true },
      }),
    ]);
    const key = (value: unknown) =>
      String(value || "")
        .trim()
        .toLowerCase();
    const lookup = (items: any[], fields: string[]) => {
      const map = new Map<string, any>();
      for (const item of items)
        for (const field of fields)
          if (item[field]) map.set(key(item[field]), item);
      return map;
    };
    const maps = {
      products: lookup(products, ["sku", "name"]),
      categories: lookup(categories, ["code", "name"]),
      vendors: lookup(vendors, ["code", "name"]),
      departments: lookup(departments, ["code", "name"]),
      locations: lookup(locations, ["code", "name"]),
      users: lookup(users, ["email"]),
      purchaseOrders: lookup(purchaseOrders, ["poNumber"]),
    };
    const usedTags = new Set(existing.map((item) => key(item.assetTag)));
    const errors: { row: number; assetTag: string; message: string }[] = [];
    const prepared: any[] = [];
    const optional = (
      map: Map<string, any>,
      value: string,
      label: string,
      row: number,
    ) => {
      if (!value) return null;
      const found = map.get(key(value));
      if (!found)
        errors.push({
          row,
          assetTag: rows[row - 2]?.assetTag || "",
          message: `${label} \"${value}\" was not found`,
        });
      return found?.id || null;
    };
    rows.forEach((item, index) => {
      const row = index + 2,
        assetKey = key(item.assetTag),
        product = maps.products.get(key(item.product)),
        category = maps.categories.get(key(item.category));
      if (usedTags.has(assetKey))
        errors.push({
          row,
          assetTag: item.assetTag,
          message: "Asset tag already exists or is duplicated in this file",
        });
      usedTags.add(assetKey);
      if (!product)
        errors.push({
          row,
          assetTag: item.assetTag,
          message: `Product \"${item.product}\" was not found`,
        });
      if (!category)
        errors.push({
          row,
          assetTag: item.assetTag,
          message: `Category \"${item.category}\" was not found`,
        });
      if (product && category && product.categoryId !== category.id)
        errors.push({
          row,
          assetTag: item.assetTag,
          message: "Product does not belong to the selected category",
        });
      const price =
        item.purchasePrice === "" ? null : Number(item.purchasePrice);
      if (price !== null && (!Number.isFinite(price) || price < 0))
        errors.push({
          row,
          assetTag: item.assetTag,
          message: "Purchase price must be a non-negative number",
        });
      const tags = [
        ...new Set(item.tags.split(/[;,]/).map(key).filter(Boolean)),
      ];
      if (tags.length > 20)
        errors.push({
          row,
          assetTag: item.assetTag,
          message: "An asset can have no more than 20 tags",
        });
      if (tags.some((tag) => tag.length > 40))
        errors.push({
          row,
          assetTag: item.assetTag,
          message: "Each tag must be 40 characters or fewer",
        });
      const parsedDates: Record<string, Date | null> = {};
      for (const field of [
        "purchaseDate",
        "commissioningDate",
        "warrantyEndDate",
        "expiryDate",
      ] as const) {
        const value = item[field];
        parsedDates[field] = value ? new Date(value) : null;
        if (value && Number.isNaN(parsedDates[field]!.getTime()))
          errors.push({
            row,
            assetTag: item.assetTag,
            message: `${field} is not a valid date`,
          });
      }
      prepared.push({
        assetTag: item.assetTag,
        serialNumber: item.serialNumber || null,
        tags,
        status: item.status,
        productId: product?.id,
        categoryId: category?.id,
        vendorId: optional(maps.vendors, item.vendor, "Vendor", row),
        departmentId: optional(
          maps.departments,
          item.department,
          "Department",
          row,
        ),
        currentLocationId: optional(
          maps.locations,
          item.location,
          "Location",
          row,
        ),
        custodianId: optional(
          maps.users,
          item.custodian,
          "Custodian email",
          row,
        ),
        purchaseOrderId: optional(
          maps.purchaseOrders,
          item.purchaseOrder,
          "Purchase order",
          row,
        ),
        purchasePrice: price,
        ...parsedDates,
        notes: item.notes || null,
      });
    });
    if (errors.length)
      return res
        .status(400)
        .json({ message: "Import validation failed", errors });
    const created = await prisma.$transaction(async (tx) => {
      const result = [];
      for (const data of prepared) {
        const asset = await tx.asset.create({
          data: {
            ...data,
            organizationId: org,
            qrValue: `ASSET:${data.assetTag}`,
          },
        });
        await tx.assetMovement.create({
          data: {
            assetId: asset.id,
            type: "RECEIPT",
            toLocationId: asset.currentLocationId,
            movedByUserId: req.user!.id,
            remarks: "Asset imported from CSV",
          },
        });
        if (asset.custodianId)
          await tx.assetAssignment.create({
            data: {
              assetId: asset.id,
              userId: asset.custodianId,
              assignedByUserId: req.user!.id,
              remarks: "Initial assignment from CSV import",
            },
          });
        result.push(asset);
      }
      return result;
    });
    await audit(req, "IMPORT", "Asset", undefined, undefined, {
      count: created.length,
      assetIds: created.map((item) => item.id),
    });
    res.status(201).json({ imported: created.length });
  },
);
assetsRouter.post(
  "/",
  authorize("SUPER_ADMIN", "ORG_ADMIN", "ASSET_MANAGER", "STORE_MANAGER"),
  async (req: AuthRequest, res) => {
    const b = assetSchema.parse(req.body),
      org = req.user!.organizationId;
    await validateRefs(b, org);
    const asset = await prisma.$transaction(async (tx) => {
      const created = await tx.asset.create({
        data: {
          ...b,
          organizationId: org,
          qrValue: b.qrValue || `ASSET:${b.assetTag}`,
        },
      });
      await tx.assetMovement.create({
        data: {
          assetId: created.id,
          type: "RECEIPT",
          toLocationId: created.currentLocationId,
          movedByUserId: req.user!.id,
          remarks: "Asset created",
        },
      });
      if (created.custodianId)
        await tx.assetAssignment.create({
          data: {
            assetId: created.id,
            userId: created.custodianId,
            assignedByUserId: req.user!.id,
            remarks: "Initial assignment",
          },
        });
      return created;
    });
    await audit(req, "CREATE", "Asset", asset.id, undefined, asset);
    res.status(201).json(asset);
  },
);
assetsRouter.put(
  "/:id",
  authorize("SUPER_ADMIN", "ORG_ADMIN", "ASSET_MANAGER", "STORE_MANAGER"),
  async (req: AuthRequest, res) => {
    const id = String(req.params.id),
      before = await prisma.asset.findFirst({
        where: { id, organizationId: req.user!.organizationId },
      });
    if (!before) throw new AppError(404, "Asset not found");
    const b = assetSchema.parse(req.body);
    await validateRefs(b, req.user!.organizationId);
    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.asset.update({ where: { id }, data: b });
      if (before.currentLocationId !== updated.currentLocationId)
        await tx.assetMovement.create({
          data: {
            assetId: id,
            type: "TRANSFER",
            fromLocationId: before.currentLocationId,
            toLocationId: updated.currentLocationId,
            movedByUserId: req.user!.id,
            remarks: "Location changed while editing asset",
          },
        });
      if (before.custodianId !== updated.custodianId) {
        await tx.assetAssignment.updateMany({
          where: { assetId: id, returnedAt: null },
          data: { returnedAt: new Date() },
        });
        if (updated.custodianId)
          await tx.assetAssignment.create({
            data: {
              assetId: id,
              userId: updated.custodianId,
              assignedByUserId: req.user!.id,
              remarks: "Custodian assigned",
            },
          });
      }
      return updated;
    });
    await audit(req, "UPDATE", "Asset", id, before, row);
    res.json(row);
  },
);
assetsRouter.delete(
  "/:id",
  authorize("SUPER_ADMIN", "ORG_ADMIN", "ASSET_MANAGER"),
  async (req: AuthRequest, res) => {
    const id = String(req.params.id),
      before = await prisma.asset.findFirst({
        where: { id, organizationId: req.user!.organizationId },
      });
    if (!before) throw new AppError(404, "Asset not found");
    await prisma.asset.delete({ where: { id } });
    await audit(req, "DELETE", "Asset", id, before);
    res.status(204).end();
  },
);
const moveSchema = z.object({
  toLocationId: z.string().cuid().nullable(),
  type: z
    .enum([
      "RECEIPT",
      "ISSUE",
      "TRANSFER",
      "RETURN",
      "MAINTENANCE",
      "DISPOSAL",
      "PHYSICAL_VERIFICATION",
    ])
    .default("TRANSFER"),
  remarks: z.string().trim().max(1000).optional(),
});
assetsRouter.post(
  "/:id/move",
  authorize(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "ASSET_MANAGER",
    "STORE_MANAGER",
    "MAINTENANCE",
  ),
  async (req: AuthRequest, res) => {
    const a = await prisma.asset.findFirst({
      where: {
        id: String(req.params.id),
        organizationId: req.user!.organizationId,
      },
    });
    if (!a) throw new AppError(404, "Asset not found");
    const data = moveSchema.parse(req.body);
    if (
      data.toLocationId &&
      !(await prisma.location.findFirst({
        where: {
          id: data.toLocationId,
          organizationId: req.user!.organizationId,
        },
      }))
    )
      throw new AppError(
        400,
        "Destination does not belong to your organization",
      );
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.asset.update({
        where: { id: a.id },
        data: {
          currentLocationId: data.toLocationId,
          status: data.type === "MAINTENANCE" ? "UNDER_MAINTENANCE" : a.status,
        },
      });
      await tx.assetMovement.create({
        data: {
          assetId: a.id,
          type: data.type,
          fromLocationId: a.currentLocationId,
          toLocationId: data.toLocationId,
          movedByUserId: req.user!.id,
          remarks: data.remarks,
        },
      });
      return row;
    });
    await audit(req, "MOVE", "Asset", a.id, a, updated);
    res.json(updated);
  },
);
async function validateRefs(b: any, org: string) {
  const checks = await Promise.all([
    prisma.product.findFirst({
      where: { id: b.productId, organizationId: org },
    }),
    prisma.assetCategory.findFirst({
      where: { id: b.categoryId, organizationId: org },
    }),
    b.vendorId
      ? prisma.vendor.findFirst({
          where: { id: b.vendorId, organizationId: org },
        })
      : true,
    b.purchaseOrderId
      ? prisma.purchaseOrder.findFirst({
          where: { id: b.purchaseOrderId, organizationId: org },
        })
      : true,
    b.departmentId
      ? prisma.department.findFirst({
          where: { id: b.departmentId, organizationId: org },
        })
      : true,
    b.currentLocationId
      ? prisma.location.findFirst({
          where: { id: b.currentLocationId, organizationId: org },
        })
      : true,
    b.custodianId
      ? prisma.user.findFirst({
          where: { id: b.custodianId, organizationId: org },
        })
      : true,
  ]);
  if (checks.some((x) => !x))
    throw new AppError(
      400,
      "One or more referenced records do not belong to your organization",
    );
  if ((checks[0] as any).categoryId !== b.categoryId)
    throw new AppError(400, "Product does not belong to the selected category");
}
