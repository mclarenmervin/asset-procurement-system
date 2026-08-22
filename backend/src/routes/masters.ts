import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { auth, AuthRequest } from "../middleware/auth.js";
import { audit } from "../audit.js";
import { AppError } from "../middleware/errors.js";
import { permit } from "../rbac.js";
export const mastersRouter = Router();
mastersRouter.use(auth, permit("masters.view"));
const managers = permit("masters.manage");
const department = z.object({
  name: z.string().trim().min(2),
  code: z.string().trim().min(1).max(30),
});
const category = z.object({
  name: z.string().trim().min(2),
  code: z.string().trim().min(1).max(30),
  depreciationRate: z.coerce.number().min(0).max(100).default(0),
});
const product = z.object({
  name: z.string().trim().min(2),
  sku: z.string().trim().min(1).max(50),
  description: z.string().trim().max(1000).optional(),
  manufacturer: z.string().trim().max(200).optional(),
  categoryId: z.string().cuid(),
});
const role = z.enum([
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
]);
const user = z.object({
  name: z.string().trim().min(2),
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase()),
  role,
  departmentId: z.string().cuid().nullable().optional(),
  password: z.string().min(8).optional(),
});
mastersRouter.get("/departments", async (req: AuthRequest, res) =>
  res.json(
    await prisma.department.findMany({
      where: { organizationId: req.user!.organizationId },
      orderBy: { name: "asc" },
    }),
  ),
);
mastersRouter.post("/departments", managers, async (req: AuthRequest, res) => {
  const d = department.parse(req.body);
  const row = await prisma.department.create({
    data: {
      ...d,
      code: d.code.toUpperCase(),
      organizationId: req.user!.organizationId,
    },
  });
  await audit(req, "CREATE", "Department", row.id, undefined, row);
  res.status(201).json(row);
});
mastersRouter.put(
  "/departments/:id",
  managers,
  async (req: AuthRequest, res) => {
    const id = String(req.params.id),
      before = await owned("department", id, req);
    const d = department.parse(req.body);
    const row = await prisma.department.update({
      where: { id },
      data: { ...d, code: d.code.toUpperCase() },
    });
    await audit(req, "UPDATE", "Department", id, before, row);
    res.json(row);
  },
);
mastersRouter.delete(
  "/departments/:id",
  managers,
  async (req: AuthRequest, res) => {
    const id = String(req.params.id),
      before = await owned("department", id, req);
    await prisma.department.delete({ where: { id } });
    await audit(req, "DELETE", "Department", id, before);
    res.status(204).end();
  },
);
mastersRouter.get("/categories", async (req: AuthRequest, res) =>
  res.json(
    await prisma.assetCategory.findMany({
      where: { organizationId: req.user!.organizationId },
      orderBy: { name: "asc" },
    }),
  ),
);
mastersRouter.post("/categories", managers, async (req: AuthRequest, res) => {
  const d = category.parse(req.body);
  const row = await prisma.assetCategory.create({
    data: {
      ...d,
      code: d.code.toUpperCase(),
      organizationId: req.user!.organizationId,
    },
  });
  await audit(req, "CREATE", "AssetCategory", row.id, undefined, row);
  res.status(201).json(row);
});
mastersRouter.put(
  "/categories/:id",
  managers,
  async (req: AuthRequest, res) => {
    const id = String(req.params.id),
      before = await owned("assetCategory", id, req);
    const d = category.parse(req.body);
    const row = await prisma.assetCategory.update({
      where: { id },
      data: { ...d, code: d.code.toUpperCase() },
    });
    await audit(req, "UPDATE", "AssetCategory", id, before, row);
    res.json(row);
  },
);
mastersRouter.delete(
  "/categories/:id",
  managers,
  async (req: AuthRequest, res) => {
    const id = String(req.params.id),
      before = await owned("assetCategory", id, req);
    await prisma.assetCategory.delete({ where: { id } });
    await audit(req, "DELETE", "AssetCategory", id, before);
    res.status(204).end();
  },
);
mastersRouter.get("/products", async (req: AuthRequest, res) =>
  res.json(
    await prisma.product.findMany({
      where: { organizationId: req.user!.organizationId },
      include: { category: true },
      orderBy: { name: "asc" },
    }),
  ),
);
mastersRouter.post("/products", managers, async (req: AuthRequest, res) => {
  const d = product.parse(req.body);
  await owned("assetCategory", d.categoryId, req);
  const row = await prisma.product.create({
    data: {
      ...d,
      sku: d.sku.toUpperCase(),
      organizationId: req.user!.organizationId,
    },
    include: { category: true },
  });
  await audit(req, "CREATE", "Product", row.id, undefined, row);
  res.status(201).json(row);
});
mastersRouter.put("/products/:id", managers, async (req: AuthRequest, res) => {
  const id = String(req.params.id),
    before = await owned("product", id, req),
    d = product.parse(req.body);
  await owned("assetCategory", d.categoryId, req);
  const row = await prisma.product.update({
    where: { id },
    data: { ...d, sku: d.sku.toUpperCase() },
    include: { category: true },
  });
  await audit(req, "UPDATE", "Product", id, before, row);
  res.json(row);
});
mastersRouter.delete(
  "/products/:id",
  managers,
  async (req: AuthRequest, res) => {
    const id = String(req.params.id),
      before = await owned("product", id, req);
    await prisma.product.delete({ where: { id } });
    await audit(req, "DELETE", "Product", id, before);
    res.status(204).end();
  },
);
mastersRouter.get(
  "/users",
  permit("users.manage"),
  async (req: AuthRequest, res) =>
    res.json(
      await prisma.user.findMany({
        where: { organizationId: req.user!.organizationId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          departmentId: true,
          department: true,
          createdAt: true,
        },
        orderBy: { name: "asc" },
      }),
    ),
);
mastersRouter.post(
  "/users",
  permit("users.manage"),
  async (req: AuthRequest, res) => {
    const d = user.extend({ password: z.string().min(8) }).parse(req.body);
    if (d.role === "SUPER_ADMIN" && req.user!.role !== "SUPER_ADMIN")
      throw new AppError(
        403,
        "Only a super administrator can assign this role",
      );
    if (d.departmentId) await owned("department", d.departmentId, req);
    const passwordHash = await bcrypt.hash(d.password, 12);
    const row = await prisma.user.create({
      data: {
        name: d.name,
        email: d.email,
        role: d.role,
        departmentId: d.departmentId,
        passwordHash,
        organizationId: req.user!.organizationId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        createdAt: true,
      },
    });
    await audit(req, "CREATE", "User", row.id, undefined, row);
    res.status(201).json(row);
  },
);
mastersRouter.put(
  "/users/:id",
  permit("users.manage"),
  async (req: AuthRequest, res) => {
    const id = String(req.params.id),
      before = await owned("user", id, req),
      d = user.parse(req.body);
    if (
      (before.role === "SUPER_ADMIN" || d.role === "SUPER_ADMIN") &&
      req.user!.role !== "SUPER_ADMIN"
    )
      throw new AppError(
        403,
        "Only a super administrator can manage this account",
      );
    if (d.departmentId) await owned("department", d.departmentId, req);
    const data: any = {
      name: d.name,
      email: d.email,
      role: d.role,
      departmentId: d.departmentId,
    };
    if (d.password) data.passwordHash = await bcrypt.hash(d.password, 12);
    const row = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        createdAt: true,
      },
    });
    await audit(req, "UPDATE", "User", id, before, row);
    res.json(row);
  },
);
mastersRouter.delete(
  "/users/:id",
  permit("users.manage"),
  async (req: AuthRequest, res) => {
    const id = String(req.params.id);
    if (id === req.user!.id)
      throw new AppError(400, "You cannot delete your own account");
    const before = await owned("user", id, req);
    if (before.role === "SUPER_ADMIN" && req.user!.role !== "SUPER_ADMIN")
      throw new AppError(
        403,
        "Only a super administrator can manage this account",
      );
    await prisma.user.delete({ where: { id } });
    await audit(req, "DELETE", "User", id, before);
    res.status(204).end();
  },
);
async function owned(
  model: "department" | "assetCategory" | "product" | "user",
  id: string,
  req: AuthRequest,
) {
  const row = await (prisma[model] as any).findFirst({
    where: { id, organizationId: req.user!.organizationId },
  });
  if (!row) throw new AppError(404, "Record not found");
  return row;
}
