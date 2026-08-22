import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { auth, AuthRequest } from "../middleware/auth.js";
import { audit } from "../audit.js";
import { AppError } from "../middleware/errors.js";
import { permit } from "../rbac.js";
export const locationsRouter = Router();
locationsRouter.use(auth, permit("locations.view"));
locationsRouter.get("/", async (req: AuthRequest, res) =>
  res.json(
    await prisma.location.findMany({
      where: { organizationId: req.user!.organizationId },
      include: { parent: true },
      orderBy: { name: "asc" },
    }),
  ),
);
const location = z.object({
  name: z.string().trim().min(2),
  code: z.string().trim().min(1).max(30),
  type: z.string().trim().min(2),
  parentId: z.string().cuid().nullable().optional(),
});
locationsRouter.post(
  "/",
  permit("locations.manage"),
  async (req: AuthRequest, res) => {
    const data = location.parse(req.body);
    if (
      data.parentId &&
      !(await prisma.location.findFirst({
        where: { id: data.parentId, organizationId: req.user!.organizationId },
      }))
    )
      throw new AppError(
        400,
        "Parent location does not belong to your organization",
      );
    const row = await prisma.location.create({
      data: {
        ...data,
        code: data.code.toUpperCase(),
        organizationId: req.user!.organizationId,
      },
    });
    await audit(req, "CREATE", "Location", row.id, undefined, row);
    res.status(201).json(row);
  },
);
locationsRouter.put(
  "/:id",
  permit("locations.manage"),
  async (req: AuthRequest, res) => {
    const id = String(req.params.id),
      before = await prisma.location.findFirst({
        where: { id, organizationId: req.user!.organizationId },
      });
    if (!before) throw new AppError(404, "Location not found");
    const data = location.parse(req.body);
    if (data.parentId === id)
      throw new AppError(400, "A location cannot be its own parent");
    if (
      data.parentId &&
      !(await prisma.location.findFirst({
        where: { id: data.parentId, organizationId: req.user!.organizationId },
      }))
    )
      throw new AppError(
        400,
        "Parent location does not belong to your organization",
      );
    const row = await prisma.location.update({
      where: { id },
      data: { ...data, code: data.code.toUpperCase() },
    });
    await audit(req, "UPDATE", "Location", id, before, row);
    res.json(row);
  },
);
locationsRouter.delete(
  "/:id",
  permit("locations.manage"),
  async (req: AuthRequest, res) => {
    const id = String(req.params.id),
      before = await prisma.location.findFirst({
        where: { id, organizationId: req.user!.organizationId },
      });
    if (!before) throw new AppError(404, "Location not found");
    await prisma.location.delete({ where: { id } });
    await audit(req, "DELETE", "Location", id, before);
    res.status(204).end();
  },
);
