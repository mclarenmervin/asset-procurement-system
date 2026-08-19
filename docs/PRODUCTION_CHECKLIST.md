# Production checklist

The codebase includes baseline application hardening. The following deployment controls must be completed for the target organization before production approval.

## Required configuration

- Set `NODE_ENV=production` and use a unique JWT secret of at least 32 random characters from a secrets manager.
- Set `FRONTEND_URL` to the exact allowed origin(s), comma-separated when more than one is required.
- Use a dedicated least-privilege PostgreSQL account and require encrypted database connections.
- Terminate TLS at a trusted reverse proxy/load balancer and forward only one trusted proxy hop to the API.
- Change or disable all seed/demo accounts.

## Persistent services

- Replace local document storage with private object storage, encryption at rest, malware scanning, lifecycle rules and signed downloads.
- Use managed PostgreSQL with point-in-time recovery, encrypted snapshots and regularly tested restores.
- Ship application and proxy logs to centralized, access-controlled storage with retention and alerting.
- Add uptime checks for `/health`, error-rate alerts, database capacity alerts and disk/object-storage monitoring.

## Identity and governance

- Integrate the organization's SSO and MFA requirements.
- Review the role-to-permission matrix with business owners and test tenant isolation.
- Define joiner/mover/leaver, periodic access review, segregation-of-duties and emergency-access processes.
- Define record retention, privacy, audit-log retention and disposal policies.

## Release gate

- Run backend and frontend production builds, integration tests and browser acceptance tests against a staging copy.
- Run dependency, secret, static-analysis and container/image scans in CI on every release.
- Commission independent penetration testing and remediate findings.
- Test backup restoration and disaster-recovery objectives.
- Document rollback, incident response, escalation contacts and change approval.

## Current local-development limitation

Uploaded files are stored on the backend filesystem. This is suitable for local testing only; horizontally scaled or ephemeral production deployments require shared private object storage.
