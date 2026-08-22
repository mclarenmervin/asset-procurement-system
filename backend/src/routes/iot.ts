import { createHash, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { prisma } from "../db.js";
import { AppError } from "../middleware/errors.js";
import { ingestTelemetry } from "../tracking-service.js";
import { telemetrySchema } from "./tracking.js";

export const iotRouter = Router();
iotRouter.post("/telemetry", async (req, res) => {
  const deviceUid = String(
      req.headers["x-device-id"] || req.body.deviceId || "",
    ),
    key = String(req.headers["x-device-key"] || "");
  if (!deviceUid || !key)
    throw new AppError(401, "Device credentials are required");
  const device = await prisma.trackerDevice.findUnique({
    where: { deviceUid },
  });
  const supplied = createHash("sha256").update(key).digest();
  const expected = device
    ? Buffer.from(device.secretHash, "hex")
    : Buffer.alloc(32);
  if (
    !device ||
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  )
    throw new AppError(401, "Invalid device credentials");
  const parsed = telemetrySchema.parse(req.body);
  const point = await ingestTelemetry(device.id, {
    ...parsed,
    rawPayload: req.body,
  });
  res
    .status(202)
    .json({ accepted: true, pointId: point.id, recordedAt: point.recordedAt });
});
