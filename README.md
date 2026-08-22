# AssetFlow Enterprise

AssetFlow Enterprise is a full-stack asset, procurement and material-management system for departments, plants, hospitals, PSUs and other multi-location organizations. It replaces disconnected registers and static dashboards with tenant-isolated workflows backed by PostgreSQL.

## What is included

- Organization, department, hierarchical location, vendor, category and product masters
- Serialized asset registry with categories, flexible tags, Excel import/export, custodians, append-only movement history and printable URL QR labels that open the complete authorized asset record
- Vendor-neutral IoT GPS tracking with device provisioning, asset assignment, route history, geofences, offline/battery/speed/tamper/SOS alerts and a built-in hardware simulator
- Purchase requests, RFQs, vendor quotations, purchase orders and sequential approvals
- Warehouses, storage bins, GRN inspection, batches, stock ledger, issue and return
- Maintenance jobs, AMC contracts, compliance records and asset disposal
- Private document upload/download, notifications and searchable audit history
- Configurable approval workflow templates
- Camera or manual QR physical verification with GPS, wrong-location and missing-asset detection
- Dashboard analytics and authenticated Excel workbook exports for assets, movements, procurement, stock, maintenance and verification
- Consistent live search and contextual status/type filters across registers, workflows, histories, audit data and reports
- JWT authentication, signup, role permissions, tenant isolation and request validation
- Centralized role-based access control with role-aware navigation, action visibility, live role refresh and department-scoped employee data
- Security headers, strict origin allowlist, API/login rate limits, compression, request IDs and database readiness checks

## Technology

| Layer           | Technology                       |
| --------------- | -------------------------------- |
| Web application | Next.js 16, React 19, TypeScript |
| API             | Node.js, Express 5, TypeScript   |
| Data            | PostgreSQL, Prisma ORM           |
| Authentication  | JWT, bcrypt                      |
| Local database  | Docker Compose                   |

## Run locally

Requirements: Node.js 20 or newer, npm and PostgreSQL 15 or newer (or Docker).

1. Start PostgreSQL:

   ```bash
   docker compose up -d
   ```

2. Configure and run the API:

   ```bash
   cd backend
   cp .env.example .env
   npm ci
   npm run prisma:generate
   npm run prisma:migrate -- --name init
   npm run seed
   npm run dev
   ```

3. In another terminal, run the web application:

   ```bash
   cd frontend
   cp .env.local.example .env.local
   npm ci
   npm run dev
   ```

Open http://localhost:3000. The API is available at http://localhost:5001.

Demo administrator (local seed only):

- Email: `admin@demo.local`
- Password: `Admin@123`

Change the demo credentials and JWT secret before any shared deployment.

## Role-based access

Permissions are enforced by the API and reflected in the web interface. `SUPER_ADMIN` and `ORG_ADMIN` have full access; organization administrators cannot grant or modify the global super-administrator role.

| Role                               | Primary access                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| Super / organization administrator | All organization modules, users, roles and workflows                                     |
| Asset manager                      | Assets, movements, documents, maintenance, verification, locations and asset master data |
| Procurement officer                | Vendors, requisitions, RFQs, quotations, purchase orders and related master data         |
| Store manager                      | Assets, stores, receipts, stock notes, verification and locations                        |
| Department head                    | Department-scoped assets and requisitions, plus assigned approvals                       |
| Maintenance                        | Asset movement/documents and maintenance operations                                      |
| Finance                            | Procurement and disposal approvals, inventory visibility and reports                     |
| Auditor                            | Read-only operational modules, audit trail, reports and physical verification            |
| Employee                           | Own/department assets, own requisitions and locations                                    |

The backend refreshes the user's current role from the database on every authenticated request, so access changes take effect immediately. Employees and department heads receive department-scoped asset and requisition data.

## IoT GPS tracking

Open **GPS Tracking** from the application navigation. Asset managers and store managers can register a tracker, assign it to an asset, configure alert thresholds and test it with the built-in simulator. Maintenance and auditor roles receive read access.

When a tracker is registered, AssetFlow displays a device ID and API key once. A future GPS device or vendor gateway sends JSON telemetry to `POST /api/iot/telemetry` with these headers:

```text
X-Device-ID: tracker-imei-or-device-id
X-Device-Key: one-time-generated-api-key
Content-Type: application/json
```

Example payload:

```json
{
  "latitude": 20.2961,
  "longitude": 85.8245,
  "speedKph": 42.5,
  "headingDegrees": 90,
  "batteryPercent": 76,
  "signalStrength": -71,
  "ignition": true,
  "motion": true,
  "tamper": false,
  "sos": false,
  "recordedAt": "2026-08-22T12:00:00.000Z"
}
```

Device keys are stored only as SHA-256 hashes. Telemetry timestamps are idempotent per device, coordinates and sensor ranges are validated, and future timestamps are rejected. Circular geofences can apply to one asset or every tracked asset. The same ingestion service is ready for a later MQTT or tracker-vendor adapter.

## Environment variables

Backend variables are documented in `backend/.env.example`:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — unique random secret, at least 32 characters
- `PORT` — API port, defaults to `5001`
- `FRONTEND_URL` — comma-separated exact CORS origins
- `NODE_ENV` — `development` or `production`

The frontend uses `NEXT_PUBLIC_API_URL` for the API and `NEXT_PUBLIC_APP_URL` as the base URL encoded in printable QR labels. Set `NEXT_PUBLIC_APP_URL` to the deployed HTTPS origin (or a reachable LAN address during phone testing), never `localhost` for labels that will be scanned by another device.

## Build and verification

```bash
cd backend
npm run prisma:generate
npm run build
npm audit --omit=dev

cd ../frontend
npm run build
npm audit --omit=dev
```

`GET /health` returns API and database readiness. All business endpoints are under `/api` and require authentication except login and signup. Reporting data is under `/api/reports`; Excel workbook downloads use `/api/reports/export/:type`.

## Project structure

```text
backend/             Express API, Prisma schema, seed and business routes
frontend/            Next.js application and module pages
docs/                Blueprint, API overview, roadmap and production checklist
docker-compose.yml   Local PostgreSQL service
```

## Production deployment

The application workflows and baseline API controls are implemented, but production accreditation depends on the target organization and hosting environment. Complete [the production checklist](docs/PRODUCTION_CHECKLIST.md) before processing real data—particularly managed secrets, TLS, private object storage, SSO/MFA, backups and restore tests, monitoring, retention policies and independent penetration testing.

Uploaded documents currently use backend-local storage and must be moved to private object storage for an ephemeral or horizontally scaled deployment.

## Documentation

- [System blueprint](docs/SYSTEM_BLUEPRINT.md)
- [API overview](docs/API_OVERVIEW.md)
- [Implementation roadmap](docs/ROADMAP.md)
- [Production checklist](docs/PRODUCTION_CHECKLIST.md)

## License

No open-source license has been assigned. All rights are reserved unless the repository owner adds a license.
