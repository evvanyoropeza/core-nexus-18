# Architecture rules

- Derive inventory warning states through the browser-safe stock-alerts helper from persisted product levels; reuse it in the catalog, kardex and notification center to keep thresholds consistent without external services.
- Derive actionable notifications from existing tenant-scoped records and store only per-user event read receipts; this avoids duplicate event history and automatically removes resolved alerts.
- Scope notification queries by user, tenant and role, and own one uniquely named Realtime channel inside an effect with cleanup; this prevents cross-company cache reuse and leaked subscriptions.