import { randomBytes, createHash } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { audit } from "../audit.js";
import { auth, AuthRequest } from "../middleware/auth.js";
import { AppError } from "../middleware/errors.js";
import { permit } from "../rbac.js";
import { ingestTelemetry } from "../tracking-service.js";

export const trackingRouter = Router();
trackingRouter.use(auth, permit("tracking.view"));
const manage = permit("tracking.manage");
const deviceSchema = z.object({
  deviceUid: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[A-Za-z0-9._:-]+$/),
  name: z.string().trim().min(2).max(100),
  model: z.string().trim().max(100).optional(),
  protocol: z.string().trim().max(30).default("HTTPS"),
  simNumber: z.string().trim().max(30).optional(),
  status: z
    .enum(["ACTIVE", "INACTIVE", "MAINTENANCE", "RETIRED"])
    .default("ACTIVE"),
  batteryThreshold: z.coerce.number().int().min(0).max(100).default(20),
  offlineAfterMinutes: z.coerce.number().int().min(1).max(10080).default(30),
  speedLimitKph: z.preprocess(
    (v) => (v === "" ? null : v),
    z.coerce.number().positive().max(500).nullable().optional(),
  ),
});
export const telemetrySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  altitudeMeters: z.coerce.number().min(-500).max(20000).optional(),
  accuracyMeters: z.coerce.number().nonnegative().max(100000).optional(),
  speedKph: z.coerce.number().nonnegative().max(1000).optional(),
  headingDegrees: z.coerce.number().min(0).max(360).optional(),
  batteryPercent: z.coerce.number().int().min(0).max(100).optional(),
  signalStrength: z.coerce.number().int().min(-200).max(100).optional(),
  ignition: z.boolean().optional(),
  motion: z.boolean().optional(),
  temperatureC: z.coerce.number().min(-100).max(200).optional(),
  tamper: z.boolean().optional(),
  sos: z.boolean().optional(),
  recordedAt: z.coerce.date().default(() => new Date()),
});
const geofenceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().min(10).max(1_000_000),
  assetId: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().cuid().nullable().optional(),
  ),
  active: z.boolean().default(true),
});

trackingRouter.get("/overview", async (req: AuthRequest, res) => {
  const org = req.user!.organizationId;
  const [devices, geofences, alerts, assets] = await Promise.all([
    prisma.trackerDevice.findMany({
      where: { organizationId: org },
      include: { asset: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.geofence.findMany({
      where: { organizationId: org },
      include: { asset: { select: { id: true, assetTag: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.trackingAlert.findMany({
      where: { organizationId: org },
      include: {
        device: { select: { name: true, deviceUid: true } },
        asset: { select: { assetTag: true } },
        geofence: { select: { name: true } },
      },
      take: 200,
      orderBy: { createdAt: "desc" },
    }),
    prisma.asset.findMany({
      where: { organizationId: org, status: { not: "DISPOSED" } },
      select: {
        id: true,
        assetTag: true,
        trackerDevice: { select: { id: true } },
        product: { select: { name: true } },
      },
      orderBy: { assetTag: "asc" },
    }),
  ]);
  res.json({ devices, geofences, alerts, assets });
});

trackingRouter.post("/devices", manage, async (req: AuthRequest, res) => {
  const data = deviceSchema.parse(req.body),
    apiKey = randomBytes(24).toString("hex");
  const row = await prisma.trackerDevice.create({
    data: {
      ...data,
      secretHash: hash(apiKey),
      organizationId: req.user!.organizationId,
    },
  });
  await audit(req, "CREATE", "TrackerDevice", row.id, undefined, {
    deviceUid: row.deviceUid,
    name: row.name,
  });
  res.status(201).json({ ...safeDevice(row), apiKey });
});
trackingRouter.put("/devices/:id", manage, async (req: AuthRequest, res) => {
  const before = await deviceOwned(String(req.params.id), req),
    data = deviceSchema.parse(req.body);
  const row = await prisma.trackerDevice.update({
    where: { id: before.id },
    data,
  });
  await audit(
    req,
    "UPDATE",
    "TrackerDevice",
    row.id,
    safeDevice(before),
    safeDevice(row),
  );
  res.json(safeDevice(row));
});
trackingRouter.delete("/devices/:id", manage, async (req: AuthRequest, res) => {
  const before = await deviceOwned(String(req.params.id), req);
  await prisma.trackerDevice.delete({ where: { id: before.id } });
  await audit(req, "DELETE", "TrackerDevice", before.id, safeDevice(before));
  res.status(204).end();
});
trackingRouter.post(
  "/devices/:id/rotate-key",
  manage,
  async (req: AuthRequest, res) => {
    const before = await deviceOwned(String(req.params.id), req),
      apiKey = randomBytes(24).toString("hex");
    await prisma.trackerDevice.update({
      where: { id: before.id },
      data: { secretHash: hash(apiKey) },
    });
    await audit(req, "ROTATE_KEY", "TrackerDevice", before.id, undefined, {
      deviceUid: before.deviceUid,
    });
    res.json({ deviceId: before.deviceUid, apiKey });
  },
);
trackingRouter.post(
  "/devices/:id/assign",
  manage,
  async (req: AuthRequest, res) => {
    const device = await deviceOwned(String(req.params.id), req);
    const { assetId } = z
      .object({ assetId: z.string().cuid().nullable() })
      .parse(req.body);
    if (
      assetId &&
      !(await prisma.asset.findFirst({
        where: { id: assetId, organizationId: req.user!.organizationId },
      }))
    )
      throw new AppError(400, "Asset does not belong to your organization");
    try {
      const row = await prisma.trackerDevice.update({
        where: { id: device.id },
        data: { assetId },
        include: { asset: true },
      });
      await audit(
        req,
        "ASSIGN",
        "TrackerDevice",
        device.id,
        { assetId: device.assetId },
        { assetId },
      );
      res.json(row);
    } catch (error: any) {
      if (error?.code === "P2002")
        throw new AppError(409, "That asset already has a tracking device");
      throw error;
    }
  },
);
trackingRouter.get("/devices/:id/history", async (req: AuthRequest, res) => {
  const device = await deviceOwned(String(req.params.id), req);
  const limit = Math.min(2000, Math.max(1, Number(req.query.limit) || 500));
  const from = req.query.from ? new Date(String(req.query.from)) : undefined,
    to = req.query.to ? new Date(String(req.query.to)) : undefined;
  res.json(
    await prisma.trackingPoint.findMany({
      where: { deviceId: device.id, recordedAt: { gte: from, lte: to } },
      take: limit,
      orderBy: { recordedAt: "desc" },
    }),
  );
});
trackingRouter.post(
  "/devices/:id/simulate",
  manage,
  async (req: AuthRequest, res) => {
    const device = await deviceOwned(String(req.params.id), req),
      parsed = telemetrySchema.parse(req.body);
    const point = await ingestTelemetry(device.id, {
      ...parsed,
      rawPayload: { source: "SIMULATOR" },
    });
    await audit(req, "SIMULATE", "TrackingPoint", point.id, undefined, {
      deviceId: device.id,
      latitude: point.latitude,
      longitude: point.longitude,
    });
    res.status(201).json(point);
  },
);
trackingRouter.post("/scan-offline", manage, async (req: AuthRequest, res) => {
  const devices = await prisma.trackerDevice.findMany({
    where: { organizationId: req.user!.organizationId, status: "ACTIVE" },
  });
  let created = 0;
  for (const device of devices) {
    const cutoff = Date.now() - device.offlineAfterMinutes * 60_000;
    if (device.lastSeenAt && device.lastSeenAt.getTime() >= cutoff) continue;
    const exists = await prisma.trackingAlert.findFirst({
      where: {
        deviceId: device.id,
        type: "OFFLINE",
        resolvedAt: null,
        acknowledgedAt: null,
      },
    });
    if (!exists) {
      await prisma.trackingAlert.create({
        data: {
          type: "OFFLINE",
          severity: "CRITICAL",
          title: "Tracker is offline",
          message: `${device.name} has not reported within ${device.offlineAfterMinutes} minutes`,
          deviceId: device.id,
          assetId: device.assetId,
          organizationId: device.organizationId,
        },
      });
      created++;
    }
  }
  res.json({ scanned: devices.length, created });
});
trackingRouter.post("/geofences", manage, async (req: AuthRequest, res) => {
  const data = geofenceSchema.parse(req.body);
  await validateAsset(data.assetId, req);
  const row = await prisma.geofence.create({
    data: { ...data, organizationId: req.user!.organizationId },
  });
  await audit(req, "CREATE", "Geofence", row.id, undefined, row);
  res.status(201).json(row);
});
trackingRouter.put("/geofences/:id", manage, async (req: AuthRequest, res) => {
  const id = String(req.params.id),
    before = await prisma.geofence.findFirst({
      where: { id, organizationId: req.user!.organizationId },
    });
  if (!before) throw new AppError(404, "Geofence not found");
  const data = geofenceSchema.parse(req.body);
  await validateAsset(data.assetId, req);
  const row = await prisma.geofence.update({ where: { id }, data });
  await audit(req, "UPDATE", "Geofence", id, before, row);
  res.json(row);
});
trackingRouter.delete(
  "/geofences/:id",
  manage,
  async (req: AuthRequest, res) => {
    const id = String(req.params.id),
      before = await prisma.geofence.findFirst({
        where: { id, organizationId: req.user!.organizationId },
      });
    if (!before) throw new AppError(404, "Geofence not found");
    await prisma.geofence.delete({ where: { id } });
    await audit(req, "DELETE", "Geofence", id, before);
    res.status(204).end();
  },
);
trackingRouter.post(
  "/alerts/:id/acknowledge",
  manage,
  async (req: AuthRequest, res) => {
    const id = String(req.params.id),
      alert = await prisma.trackingAlert.findFirst({
        where: { id, organizationId: req.user!.organizationId },
      });
    if (!alert) throw new AppError(404, "Tracking alert not found");
    res.json(
      await prisma.trackingAlert.update({
        where: { id },
        data: {
          acknowledgedAt: new Date(),
          acknowledgedByUserId: req.user!.id,
        },
      }),
    );
  },
);

async function deviceOwned(id: string, req: AuthRequest) {
  const row = await prisma.trackerDevice.findFirst({
    where: { id, organizationId: req.user!.organizationId },
  });
  if (!row) throw new AppError(404, "Tracking device not found");
  return row;
}
async function validateAsset(
  assetId: string | null | undefined,
  req: AuthRequest,
) {
  if (
    assetId &&
    !(await prisma.asset.findFirst({
      where: { id: assetId, organizationId: req.user!.organizationId },
    }))
  )
    throw new AppError(400, "Asset does not belong to your organization");
}
function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
function safeDevice<T extends { secretHash: string }>(row: T) {
  const { secretHash, ...safe } = row;
  return safe;
}
