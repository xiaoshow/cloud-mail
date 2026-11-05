# OCI ARM2 mail body cache

Deployed on `arm` (YOUR_SERVER_IP), systemd unit `cloud-mail-cache`.
The Python service listens only on 127.0.0.1:18826. An authenticated HTTPS
location on the existing Cloudflare-proxied nginx server forwards requests.
The existing relay and media locations are preserved.

The Worker verifies the session and `all-email:query` permission before serving
`/api/allEmail/detail`. Each read checks current message metadata in D1;
deleted messages cannot be retrieved from the cache. Attachments and mutable
status are loaded live. Only immutable `content` and `text` are cached.

Bodies are AES-256-GCM encrypted in the Worker before transit to OCI. Cache
keys are SHA-256 hashes, bound as authenticated additional data. OCI stores
no plaintext bodies, mailbox passwords or user session tokens. The bearer
secret is in a root-readable environment file and Worker secrets; never
print or commit it. No public CDN caching is enabled.

Cache misses and outages fall back to D1. Reads time out after 1.2 seconds;
writes occur via `waitUntil`. Retention is seven days; payload storage is
capped at 256 MiB. systemd restarts failures, limits RAM to 128 MiB and CPU to
20%, and runs a dynamic unprivileged account with a private state directory.

Frontend All Mail no longer requests the entire page of full bodies after
loading summaries. Opening a message requests its detail explicitly and
displays loading/error/retry states. Other mailbox views retain their existing
behavior.

Checks: `node --test oci-cache/test-body-cache.mjs`, frontend Vite build,
Worker deploy dry-run, authenticated cache health, encrypted object count,
and unauthenticated denial. Recent 30 received messages were warmed at deployment.

Operations: `ssh arm 'sudo systemctl status cloud-mail-cache'`.
Cache database: `/var/lib/cloud-mail-cache/cache.sqlite3`.
nginx rollback copy: `/etc/nginx/conf.d/codex-remote.conf.before-mail-cache`.
Worker deployment: `dd627235-0e8e-479b-b3db-fbca460e1c89`.
Disabling BODY_CACHE_URL makes detail reads fall back directly to D1.
