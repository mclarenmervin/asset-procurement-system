import { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { AppError } from "./middleware/errors.js";

export type Telemetry = {
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
  accuracyMeters?: number;
  speedKph?: number;
  headingDegrees?: number;
  batteryPercent?: number;
  signalStrength?: number;
  ignition?: boolean;
  motion?: boolean;
  temperatureC?: number;
  tamper?: boolean;
  sos?: boolean;
  recordedAt: Date;
  rawPayload?: Prisma.InputJsonValue;
};

export async function ingestTelemetry(deviceId: string, data: Telemetry) {
  const device = await prisma.trackerDevice.findUnique({
    where: { id: deviceId },
    include: { asset: { select: { id: true, assetTag: true } } },
  });
  if (!device || device.status !== "ACTIVE")
    throw new AppError(404, "Active tracking device not found");
  if (data.recordedAt.getTime() > Date.now() + 5 * 60_000)
    throw new AppError(400, "Telemetry timestamp cannot be in the future");
  const previous = await prisma.trackingPoint.findFirst({
    where: { deviceId },
    orderBy: { recordedAt: "desc" },
  });
  try {
    const point = await prisma.$transaction(async (tx) => {
      const created = await tx.trackingPoint.create({
        data: {
          latitude: data.latitude,
          longitude: data.longitude,
          altitudeMeters: data.altitudeMeters,
          accuracyMeters: data.accuracyMeters,
          speedKph: data.speedKph,
          headingDegrees: data.headingDegrees,
          batteryPercent: data.batteryPercent,
          signalStrength: data.signalStrength,
          ignition: data.ignition,
          motion: data.motion,
          temperatureC: data.temperatureC,
          recordedAt: data.recordedAt,
          rawPayload: data.rawPayload,
          deviceId,
          organizationId: device.organizationId,
        },
      });
      const isNewest =
        !device.lastTelemetryAt || data.recordedAt >= device.lastTelemetryAt;
      await tx.trackerDevice.update({
        where: { id: deviceId },
        data: {
          lastSeenAt: new Date(),
          ...(isNewest
            ? {
                lastTelemetryAt: data.recordedAt,
                lastLatitude: data.latitude,
                lastLongitude: data.longitude,
                lastSpeedKph: data.speedKph,
                lastBatteryPercent: data.batteryPercent,
              }
            : {}),
        },
      });
      await tx.trackingAlert.updateMany({
        where: { deviceId, type: "OFFLINE", resolvedAt: null },
        data: { resolvedAt: new Date() },
      });
      return created;
    });
    await evaluateAlerts(device, data, previous);
    return point;
  } catch (error: any) {
    if (error?.code === "P2002")
      throw new AppError(409, "This telemetry timestamp was already received");
    throw error;
  }
}

async function evaluateAlerts(device: any, data: Telemetry, previous: any) {
  const base = {
    deviceId: device.id,
    assetId: device.assetId,
    organizationId: device.organizationId,
    latitude: data.latitude,
    longitude: data.longitude,
  };
  if (
    data.batteryPercent !== undefined &&
    data.batteryPercent <= device.batteryThreshold
  )
    await createOpenAlert(device.id, "LOW_BATTERY", {
      ...base,
      severity: "WARNING",
      title: "Tracker battery is low",
      message: `${device.name} battery is at ${data.batteryPercent}%`,
    });
  else if (data.batteryPercent !== undefined)
    await prisma.trackingAlert.updateMany({
      where: { deviceId: device.id, type: "LOW_BATTERY", resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
  if (
    data.speedKph !== undefined &&
    device.speedLimitKph &&
    data.speedKph > device.speedLimitKph
  )
    await createOpenAlert(device.id, "SPEED", {
      ...base,
      severity: "WARNING",
      title: "Asset speed limit exceeded",
      message: `${device.name} reported ${data.speedKph} km/h (limit ${device.speedLimitKph} km/h)`,
    });
  else if (data.speedKph !== undefined)
    await prisma.trackingAlert.updateMany({
      where: { deviceId: device.id, type: "SPEED", resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
  if (data.tamper)
    await createOpenAlert(device.id, "TAMPER", {
      ...base,
      severity: "CRITICAL",
      title: "Tracker tamper detected",
      message: `${device.name} reported a tamper event`,
    });
  if (data.sos)
    await createOpenAlert(device.id, "SOS", {
      ...base,
      severity: "CRITICAL",
      title: "Tracker SOS alert",
      message: `${device.name} reported an SOS event`,
    });
  const geofences = await prisma.geofence.findMany({
    where: {
      organizationId: device.organizationId,
      active: true,
      OR: [{ assetId: null }, { assetId: device.assetId || "__UNASSIGNED__" }],
    },
  });
  for (const fence of geofences) {
    const inside =
      distanceMeters(
        data.latitude,
        data.longitude,
        fence.latitude,
        fence.longitude,
      ) <= fence.radiusMeters;
    const wasInside = previous
      ? distanceMeters(
          previous.latitude,
          previous.longitude,
          fence.latitude,
          fence.longitude,
        ) <= fence.radiusMeters
      : true;
    if (inside === wasInside) continue;
    const type = inside ? "GEOFENCE_ENTRY" : "GEOFENCE_EXIT";
    await prisma.trackingAlert.create({
      data: {
        ...base,
        geofenceId: fence.id,
        type,
        severity: inside ? "INFO" : "CRITICAL",
        title: inside ? "Asset entered geofence" : "Asset left geofence",
        message: `${device.asset?.assetTag || device.name} ${inside ? "entered" : "left"} ${fence.name}`,
      },
    });
  }
}

async function createOpenAlert(deviceId: string, type: any, data: any) {
  const open = await prisma.trackingAlert.findFirst({
    where: { deviceId, type, resolvedAt: null, acknowledgedAt: null },
  });
  if (!open) await prisma.trackingAlert.create({ data: { ...data, type } });
}

export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const rad = (value: number) => (value * Math.PI) / 180;
  const dLat = rad(lat2 - lat1),
    dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
