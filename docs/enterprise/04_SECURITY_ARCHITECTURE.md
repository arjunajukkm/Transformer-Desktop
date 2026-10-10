# Security architecture

Stage 1 proposal, 4 October 2026. No controls are claimed to be implemented. Read with [data architecture](02_DATA_ARCHITECTURE.md), [metric contracts](03_METRIC_SEMANTIC_LAYER.md) and [acceptance gates](08_ACCEPTANCE_GATES.md).

## Evidence and threat model

The desktop trusts its operator and local filesystem. Repository evidence includes plaintext dotenv persistence in `id_card_module.py:75`, no application authorization boundary, an export path missing dashboard filters (`workforce_intelligence/dashboard_shell.py:3871`), and a formula-injection probe that wrote `=1+1` as an executable Excel formula. An ignored populated `.env` exists; this document does not reproduce its contents or establish that credentials were compromised. These patterns cannot become shared-service defaults.

Protected assets: employee identities, attendance and leave details, organizational relationships, connector credentials, policy configurations, historical evidence and exports. Threat actors include unauthenticated callers, authenticated users exceeding scope, compromised accounts/workers, malicious spreadsheet content, and accidental operator exposure. Network privacy alone is not authorization. An administrator who operates infrastructure need not have permission to browse HR records.

| Trust boundary | Threat | Required control |
|---|---|---|
| Browser → edge/API | Session theft, CSRF, forged tenant/filter, injection | TLS, protected session, CSRF defenses, typed requests, server identity and entitlement resolution |
| API → domain/query | Object/row/column privilege escalation | Policy checks on every operation; mandatory scoped query plan; deny unknown permissions |
| Query → PostgreSQL | Missing tenant predicate, pooled connection leakage | Parameterized SQL, transaction-local security context, restrictive DB roles and RLS where applicable |
| Worker → connector/raw store | Secret theft, hostile input, SSRF, partial source | Scoped secret access, fixed connector hosts, bounded parsing, coverage validation |
| Worker → published release | Stale worker overwrites results | Lease fencing, immutable artifacts, transactional publication |
| Export → download/browser | Durable data escape, spreadsheet execution | Explicit export entitlement, safe literal cells, private storage, expiry, reauthorization |
| Operations → backups/logs | HR payload leakage, unmanaged retention | Separate roles, redaction, encryption, audited restore and deletion ledger |

## Identity and sessions

Use the organization's existing OIDC provider. Prefer same-origin SPA/API with server-side authorization-code flow, PKCE, state and nonce; validate issuer, audience, signature, expiry and redirect URIs using maintained libraries. External subject identity is `(issuer, subject)`, not a mutable email address. Map membership and entitlements server-side. Never accept tenant or role claims merely because the browser supplies them. OIDC establishes identity; application rules still determine access. [OIDC Core](https://openid.net/specs/openid-connect-core-1_0.html).

Keep tokens on the server, encrypted when persisted; browser receives a random opaque session cookie with Secure, HttpOnly and appropriate SameSite attributes. No access/refresh tokens in localStorage, URL or analytics. Rotate session identifiers on login/privilege change, enforce idle and absolute expiry, revoke on logout/deprovisioning and recheck entitlements for sensitive operations. Start with proposed 30-minute idle/8-hour absolute sessions, subject to enterprise policy. SameSite alone is not the complete CSRF control: validate origin and use a token for state-changing requests. Restrict CORS, implement CSP, escape displayed source text and prevent arbitrary HTML injection. Rate-limit login callbacks and expensive endpoints. Session guidance: [OWASP session management](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Session_Management_Cheat_Sheet.md).

Automated connector workers use service identities, not human browser sessions. Do not create a parallel password database if SSO is available. Local desktop credential remediation precedes shared deployment: OS credential vault or runtime secret injection, no new plaintext persistence; controlled credential rotation if exposure is established.

## RBAC and scoped access

Roles are named permission bundles, not sufficient row access. Effective access is the intersection of authenticated tenant membership, operation permission, permitted columns, current organization/employee entitlements and any approved purpose constraints. Product/security owners must approve actual bundles before onboarding.

| Persona/bundle | Proposed capabilities | Explicit limits |
|---|---|---|
| Analyst | Approved aggregates, Explorer and saved views in assigned scope | Raw identifiers and export need separate grants |
| HRBP | Scoped employee detail, trends and permitted exports | No implicit organization-wide benchmark/detail |
| HR leadership | Approved broad aggregates and comparisons | Aggregate access does not imply all raw leave records |
| Data steward | Import reconciliation, quarantine and approved corrections | Separate policy editing and bulk export privileges |
| Policy administrator | Draft/version/activate policies under approved workflow | No automatic HR browsing entitlement |
| Platform administrator | Deploy, monitor, recover | No routine application data access; break-glass is time-limited/audited |

Represent grants with tenant, subject/group, capability, dimension scope, effective interval and entitlement version. Resolve current grants independently from historical organization attribution. A user viewing a past release does not recover revoked permissions. Whether an HRBP can see a transferred employee's earlier history requires a product decision; default deny outside current explicit grants. Import corrections and policy activation require separate write privileges and audit reasons. Prohibit clients from choosing a security context or SQL predicate.

Scope all endpoints, including counts/facets, search suggestions, saved-view titles, lineage, job status, downloads, comparisons and errors. Reject inaccessible object IDs without disclosing their existence. A shared saved view shares configuration, never the creator's authority. Group memberships, exports and dataset switches cannot bypass this rule.

Application query compilation provides the primary consistent policy boundary. PostgreSQL RLS adds defense for suitable facts/dimensions: use a non-owner application role without BYPASSRLS, separate migration owner, FORCE ROW LEVEL SECURITY where appropriate, and transaction-local tenant/subject settings cleared by transaction end. Test pool reuse and error rollback explicitly. PostgreSQL owners normally bypass RLS and privileged roles can bypass it; configuring policies is not sufficient by itself. [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

Preaggregates must retain sufficient permitted scope or be published as separately authorized aggregate products. A company total cannot be safely filtered into an arbitrary employee subset after aggregation. Do not assume source-table RLS automatically protects copied aggregates, Parquet or worker results. Scoped cache keys include the entitlement fingerprint/version; hits still require current authorization. An expired/revoked subject cannot replay an old query handle.

Small-cohort suppression, minimum sample sizes and overlapping-query inference controls need HR privacy approval. Until thresholds and use cases are signed, cross-scope peer benchmarks and sensitive small cohorts remain disabled. Suppress associated numerator/denominator/detail/facet paths consistently; do not claim suppression alone guarantees anonymity.

## Export and download governance

1. Require explicit export permission, allowed columns, purpose if policy requires it, size quota and authorized canonical QuerySpec. Pin release, metric/policy versions, as-of date, full filters and entitlement version.
2. Reauthorize when the worker starts. If authority changed, cancel or require a fresh request; do not silently broaden or change scope. Generate with the same semantic compiler as the dashboard, including manager/employee/custom dates.
3. Write data values as literal typed XLSX cells, disable automatic formula/URL conversion, sanitize spreadsheet-dangerous text including leading control characters and `=`, `+`, `-`, `@`. Legitimate numeric negatives remain numeric. Apply escaping only in presentation output; preserve raw lineage unchanged. CSV quoting does not neutralize formulas; use a documented safe text policy and compatibility tests. No macros, external links or user-controlled formulas.
4. Stream/batch output under job budgets. Include metadata sheet/manifest with query, versions, coverage, units, timezone and exclusion counts; do not disclose unauthorized source identifiers. Record complete row count and checksum, or fail the artifact.
5. Store private, encrypted artifacts under non-guessable keys with proposed 24-hour expiry. Default to authenticated download proxy so revocation can be enforced at retrieval. If signed URLs are adopted, use very short expiry, acknowledge bearer-link revocation limits and obtain security approval. Recheck requester access at download; job possession is not permission.
6. Log initiation, completion/failure, authorized download and deletion. Prevent public sharing; do not email attachments automatically. Retention cleanup covers failed partial files too. Browser receives sensitive responses with appropriate no-store caching policy.

## Ingress, secrets and deployment

Validate file size, actual format, sheet/column count, archive expansion and row/text limits. Process untrusted workbook parsing in a constrained worker with temporary storage quotas; do not execute macros or spreadsheet expressions. Validate connector parameters, allowlist provider endpoints and prevent credential-bearing redirects or arbitrary fetch URLs. Parameterize SQL; allowlist dimension names, operators, sorts and metric versions. Limit request depth, filter cardinality and regex-like search complexity.

Use managed secret storage or deployment secret injection with access audit and rotation, not committed config or database plaintext. Separate connector, signing, database and object-store credentials. TLS for all browser, database and object connections; encryption at rest for volumes/objects/backups, controlled keys and recovery access. Private DB/store networking and least-privilege service identities. Workers cannot administer identity or fetch every tenant's secrets by default. Production images are pinned, scanned and reproducible; developer copies use synthetic data. Remove reliance on `--no-sandbox` browser launch flags for server workflows; isolate any necessary renderer.

## Classification, retention and audit

Classify raw employee detail and identifiable derived facts as restricted HR data; aggregates remain sensitive until reviewed for disclosure risk. Minimize names/free text in analytical projections. No production records in fixtures, screenshots or telemetry. Policy owner decides retention by raw/curated/revision/audit/export/backup class and applicable obligations; this is an engineering proposal, not legal or certification advice. Holds, deletion requests and retention expiry must remove references/projections/caches and be reapplied after restore. Document any immutable-backup deletion delay.

Audit events contain event ID, UTC time, actor/service ID, tenant, operation, protected object reference, outcome/reason code, correlation/job ID, query hash, scope fingerprint, release/metric/policy versions and export count/checksum where applicable. Store readable query details only in a separately restricted audit record if needed; general logs use opaque hashes. Audit admin changes, grants/revocations, policy/release publication, exports, detail access and break-glass. Restrict append/update rights and audit readers; external immutable retention is optional if required by policy.

Application logs never contain source rows, leave reasons, names, tokens, cookies, passwords, signed URLs or raw SQL parameters. Use structured allowlisted fields and redact exception payloads. Metrics avoid employee IDs and arbitrary filter labels. Record data-access events at request/job granularity; avoid one log per scanned row. Test redaction with seeded synthetic secrets, including failure paths. Logging failure must not silently permit unaudited export; define durable audit-write failure behavior for sensitive actions.

## Required security evidence

Before shared pilot: owner-approved permission matrix; negative authorization tests across every surface; cross-tenant and pooled-session tests; revoked export/cursor/cache replay tests; formula-safe file inspection; secret/log scan; dependency report; backup access review; session expiry/CSRF tests; threat review with resolved critical findings. Residual findings need an accountable owner and dated disposition. No compliance certification is asserted.
