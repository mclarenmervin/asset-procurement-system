# System Blueprint

## Purpose

Track the complete lifecycle of assets and materials from requirement and vendor procurement through receipt, issue, use, transfer, maintenance, expiry/warranty, physical verification and disposal.

## Lifecycle

Requirement → Approval → RFQ/Tender → Evaluation → PO → Vendor Delivery → GRN → Inspection → Inventory/Asset Creation → Issue/Installation → Transfer → Maintenance → Verification → Expiry/Disposal.

## Organization hierarchy

Organization → Region/Unit → Mine/Plant/Office → Department → Building/Area → Room/Operational Location → Asset.

Hierarchy must remain configurable so different departments can adopt the same platform.

## Core modules

1. Identity, users, roles and organization tenancy
2. Department/location master
3. Vendor onboarding and performance
4. Product/material/category master
5. Purchase requisitions
6. Tender/RFQ and quotation comparison
7. Purchase orders
8. Goods receipt and quality inspection
9. Serialized asset registry
10. Material/store inventory and batch/lot tracking
11. Asset allocation and custody
12. Asset movements/transfers
13. QR/barcode tagging and scanning
14. Warranty, expiry, calibration and insurance alerts
15. Maintenance, AMC and service history
16. Physical verification
17. Disposal/condemnation/scrap/auction
18. Documents
19. Approval workflow
20. Audit trail
21. Dashboards and statutory/management reports
22. Notifications and integrations

## Key asset record

Each asset should retain asset tag, QR/barcode, product/category, serial number, manufacturer, vendor, PO, invoice/GRN, purchase price/date, commissioning date, warranty, expiry/calibration/insurance dates, department, custodian, current location, status, documents, movement history, maintenance history and disposal details.

## Movement ledger rule

`assets.currentLocationId` is a convenience field for fast reads. Every location/status movement must also create an immutable `AssetMovement` record. Never rely solely on overwriting current location.

## Material/inventory distinction

Serialized assets are tracked one-by-one. Consumables/spares are tracked as quantity transactions by store, bin, batch and optionally expiry. A later phase should add Warehouse, Bin, MaterialBatch, StockLedger, Reservation, IssueNote and ReturnNote entities.

## Suggested role model

- SUPER_ADMIN
- ORG_ADMIN
- PROCUREMENT_OFFICER
- STORE_MANAGER
- DEPARTMENT_HEAD
- ASSET_MANAGER
- MAINTENANCE
- FINANCE
- AUDITOR
- EMPLOYEE

Permissions should ultimately be capability-based rather than relying only on a role enum.

## Example approval workflow

Department Requisition → Department Head → Procurement → Technical Evaluation → Finance → Competent Authority → PO → Store Receipt → Inspection → Acceptance → Issue.

The production system should store workflows as configurable templates with step conditions based on value, asset type, organization, department and procurement method.

## Reports

- Asset register by location/department/category
- Vendor-wise supplied assets
- PO vs received vs pending
- GRN/inspection report
- Asset movement register
- Assets outside assigned location
- Warranty/expiry/calibration due
- Maintenance cost by asset/category/vendor
- Idle assets
- Lost/damaged assets
- Disposal register
- Physical-verification discrepancy report
- Procurement lead time
- Vendor on-time delivery/quality score
- Asset capitalization/depreciation exports

## QR workflow

QR contains a non-sensitive unique identifier or signed URL. On scan, an authorized user sees the asset record and can perform permitted actions such as verify, issue, transfer, return or open maintenance request. Do not place confidential asset details directly in QR payloads.

## Security requirements for production

- SSO/OIDC/SAML where required
- MFA for privileged accounts
- Fine-grained RBAC/ABAC
- Tenant isolation
- TLS everywhere
- Encryption at rest
- Secret manager rather than source-code secrets
- Tamper-resistant audit logs
- Session/token revocation
- IP/device logs for sensitive actions
- Rate limiting
- Malware scanning for documents
- Scheduled backup and restore tests
- Vulnerability scanning and dependency patching
- Least-privilege database/service accounts
- Data retention and deletion policies

## Integration candidates

ERP/SAP, GeM/procurement portals where authorized APIs exist, finance/accounting, HR employee master, email/SMS gateways, directory/SSO, RFID/barcode printers, handheld scanners and BI platforms.
