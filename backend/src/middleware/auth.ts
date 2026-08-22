import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db.js";
export type AuthRequest = Request & {
  user?: {
    id: string;
    role: string;
    organizationId: string;
    departmentId: string | null;
  };
};
export async function auth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    if (!payload.id || !payload.organizationId)
      throw new Error("Invalid claims");
    const user = await prisma.user.findFirst({
      where: { id: payload.id, organizationId: payload.organizationId },
      select: {
        id: true,
        role: true,
        organizationId: true,
        departmentId: true,
      },
    });
    if (!user) throw new Error("User no longer exists");
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}
