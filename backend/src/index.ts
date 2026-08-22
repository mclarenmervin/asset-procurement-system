import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { authRouter } from "./routes/auth.js";
import { assetsRouter } from "./routes/assets.js";
import { vendorsRouter } from "./routes/vendors.js";
import { locationsRouter } from "./routes/locations.js";
import { procurementRouter } from "./routes/procurement.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { mastersRouter } from "./routes/masters.js";
import { inventoryRouter } from "./routes/inventory.js";
import { maintenanceRouter } from "./routes/maintenance.js";
import { documentsRouter } from "./routes/documents.js";
import { governanceRouter } from "./routes/governance.js";
import { verificationRouter } from "./routes/verification.js";
import { reportsRouter } from "./routes/reports.js";
import { trackingRouter } from "./routes/tracking.js";
import { iotRouter } from "./routes/iot.js";
import { errors } from "./middleware/errors.js";
import { prisma } from "./db.js";
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
  throw new Error("JWT_SECRET of at least 32 characters is required");
const origins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((x) => x.trim());
const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader(
    "X-Request-ID",
    String(req.headers["x-request-id"] || randomUUID()),
  );
  next();
});
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use(compression());
app.use(
  cors({
    origin(origin, callback) {
      callback(null, !origin || origins.includes(origin));
    },
    credentials: false,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many requests; try again later" },
  }),
);
app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many login attempts; try again later" },
  }),
);
app.get("/health", async (_, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: "Asset Procurement API", database: "ready" });
  } catch {
    res.status(503).json({
      ok: false,
      service: "Asset Procurement API",
      database: "unavailable",
    });
  }
});
app.use("/api/auth", authRouter);
app.use("/api/assets", assetsRouter);
app.use("/api/vendors", vendorsRouter);
app.use("/api/locations", locationsRouter);
app.use("/api/procurement", procurementRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/maintenance", maintenanceRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/governance", governanceRouter);
app.use("/api/verification", verificationRouter);
app.use("/api/iot", iotRouter);
app.use("/api/tracking", trackingRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/masters", mastersRouter);
app.use((_req, res) => res.status(404).json({ message: "Route not found" }));
app.use(errors);
const port = Number(process.env.PORT || 5001);
const server = app.listen(port, () =>
  console.log(`API running on http://localhost:${port}`),
);
async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
