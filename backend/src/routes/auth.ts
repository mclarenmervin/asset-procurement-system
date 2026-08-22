import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../db.js";
import { auth, AuthRequest } from "../middleware/auth.js";
export const authRouter = Router();
const credentials = z.object({
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase()),
  password: z.string().min(8),
});
function session(user: any) {
  const token = jwt.sign(
    { id: user.id, role: user.role, organizationId: user.organizationId },
    process.env.JWT_SECRET!,
    { expiresIn: "12h" },
  );
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization: user.organization.name,
    },
  };
}
authRouter.post("/login", async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Enter a valid email and password" });
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email },
    include: { organization: true },
  });
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return res.status(401).json({ message: "Invalid credentials" });
  res.json(session(user));
});
authRouter.get("/me", auth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { organization: true },
  });
  if (!user) return res.status(401).json({ message: "User no longer exists" });
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
    organization: user.organization.name,
  });
});
authRouter.post("/signup", async (req, res) => {
  const parsed = credentials
    .extend({
      name: z.string().trim().min(2),
      organizationName: z.string().trim().min(2),
      organizationCode: z
        .string()
        .trim()
        .min(2)
        .max(20)
        .regex(/^[A-Za-z0-9-]+$/),
    })
    .safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      message: parsed.error.issues[0]?.message || "Invalid signup details",
    });
  const { name, email, password, organizationName, organizationCode } =
    parsed.data;
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: organizationName, code: organizationCode.toUpperCase() },
      });
      return tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: "ORG_ADMIN",
          organizationId: organization.id,
        },
        include: { organization: true },
      });
    });
    res.status(201).json(session(user));
  } catch {
    return res
      .status(409)
      .json({ message: "Email or organization code already exists" });
  }
});
