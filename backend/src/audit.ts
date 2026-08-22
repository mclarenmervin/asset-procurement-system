import { prisma } from "./db.js";
import { AuthRequest } from "./middleware/auth.js";
export async function audit(
  req: AuthRequest,
  action: string,
  entityType: string,
  entityId?: string,
  beforeJson?: unknown,
  afterJson?: unknown,
) {
  await prisma.auditLog.create({
    data: {
      organizationId: req.user!.organizationId,
      userId: req.user!.id,
      action,
      entityType,
      entityId,
      beforeJson: beforeJson as any,
      afterJson: afterJson as any,
      ipAddress: req.ip,
    },
  });
}
