# 🚨 Cendaro ERP — Incident Response Runbook

This document provides step-by-step procedures for security incident response. Follow the appropriate playbook based on the incident type.

---

## Table of Contents

1. [Compromised Account](#1-compromised-account)
2. [Secret Rotation](#2-secret-rotation)
3. [Database Breach Response](#3-database-breach-response)
4. [Rate Limit / DDoS Escalation](#4-rate-limit--ddos-escalation)
5. [Dependency Vulnerability](#5-dependency-vulnerability)
6. [Post-Incident Review](#6-post-incident-review)

---

## 1. Compromised Account

**Trigger:** User reports unauthorized activity, or anomalous login patterns detected.

### Immediate Actions (< 15 minutes)

1. **Disable the account** via Supabase dashboard:
   - Auth → Users → Find user → Ban User
2. **Revoke all sessions:**
   ```sql
   -- Run via Supabase SQL Editor
   DELETE FROM auth.sessions WHERE user_id = '<USER_UUID>';
   DELETE FROM auth.refresh_tokens WHERE user_id = '<USER_UUID>';
   ```
3. **Check audit trail** for actions performed during compromise:
   ```sql
   SELECT * FROM audit_log
   WHERE user_id = '<USER_UUID>'
   AND created_at > NOW() - INTERVAL '7 days'
   ORDER BY created_at DESC;
   ```
4. **Notify the account owner** via alternate channel (phone/WhatsApp)

### Recovery Actions (< 24 hours)

1. Reset user password via Supabase Auth dashboard
2. **Force MFA enrollment** — if user is owner/admin, they must re-enroll TOTP
3. Review and revert any unauthorized data changes
4. Document the incident in the post-incident log

---

## 2. Secret Rotation

**Trigger:** Suspected secret exposure (environment variable leak, git history exposure).

### Rotation Checklist

| Secret                          | Where to Rotate                          | Impact                       |
| ------------------------------- | ---------------------------------------- | ---------------------------- |
| `DATABASE_URL`                  | Supabase Dashboard → Settings → Database | All DB connections restart   |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase Dashboard → Settings → API      | Server-side auth calls       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API      | Client-side auth calls       |
| `GROQ_API_KEY`                  | Groq Console                             | AI parsing endpoint          |
| `JWT_SECRET`                    | Supabase Dashboard → Settings → API      | **All sessions invalidated** |
| `EXCHANGE_RATE_API_KEY`         | ExchangeRate API Dashboard               | Rate fetcher                 |

### Procedure

1. **Generate new secret** in the respective dashboard
2. **Update Vercel environment variables:**
   ```bash
   vercel env rm SECRET_NAME production
   vercel env add SECRET_NAME production
   ```
3. **Redeploy:**
   ```bash
   vercel --prod
   ```
4. **Verify** the application is functioning normally
5. **Audit git history** — if the secret was committed:
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env" \
     --prune-empty --tag-name-filter cat -- --all
   ```

---

## 3. Database Breach Response

**Trigger:** Unauthorized data access detected via audit logs or user reports.

### Immediate Actions

1. **Assess scope:**
   ```sql
   -- Check recent admin actions
   SELECT * FROM audit_log
   WHERE action IN ('export', 'bulk_delete', 'role_change')
   AND created_at > NOW() - INTERVAL '24 hours';
   ```
2. **Enable point-in-time recovery** (if on Pro plan):
   - Supabase Dashboard → Database → Backups → Restore
3. **Consider database password rotation** (Section 2)
4. **Review RLS policies** — verify no policies were bypassed:
   ```sql
   SELECT schemaname, tablename, policyname, cmd, qual
   FROM pg_policies
   WHERE schemaname = 'public';
   ```

### Data Notification

If customer PII was accessed:

1. Document the breach scope and affected data
2. Notify affected users within 72 hours
3. File with relevant data protection authority if applicable

---

## 4. Rate Limit / DDoS Escalation

**Trigger:** Sustained high-volume requests exceeding normal traffic patterns.

### Detection Signs

- Login endpoint responding with 429 at abnormal frequency
- Server response times degrading significantly
- Vercel logs showing traffic spike from single IP range

### Response Procedure

1. **Check current rate limit state** — in-memory counters reset on deploy
2. **Identify attack pattern:**
   - Single IP → Add to Vercel WAF blocklist
   - Distributed IPs → Escalate to Vercel support
3. **Emergency deploy** to reset in-memory state (nuclear option):
   ```bash
   vercel --prod --force
   ```
4. **Post-attack:** Consider migrating to Redis-backed rate limiter (Upstash)

---

## 5. Dependency Vulnerability

**Trigger:** Dependabot alert or `pnpm audit` finding.

### Triage

```bash
pnpm audit --prod       # Production dependencies only
pnpm audit              # All dependencies
```

### Severity Matrix

| Severity | SLA        | Action                         |
| -------- | ---------- | ------------------------------ |
| Critical | < 4 hours  | Immediate patch or mitigation  |
| High     | < 24 hours | Patch in next deployment cycle |
| Medium   | < 7 days   | Schedule for next sprint       |
| Low      | < 30 days  | Track in backlog               |

### Patch Procedure

```bash
pnpm update <package>@latest
pnpm --filter @cendaro/erp typecheck
pnpm --filter @cendaro/erp build
# If passes: commit and deploy
```

---

## 6. Post-Incident Review

Within **48 hours** of any security incident, complete a post-mortem:

### Template

```markdown
## Incident Report — [DATE]

**Type:** [Compromised Account / Secret Leak / Data Breach / DDoS]
**Severity:** [P0/P1/P2/P3]
**Duration:** [Start time — End time]
**Impact:** [Number of affected users/records]

### Timeline

- HH:MM — Event detected
- HH:MM — Response initiated
- HH:MM — Incident contained
- HH:MM — Normal operations restored

### Root Cause

[Description]

### Actions Taken

1. [Action 1]
2. [Action 2]

### Prevention Measures

- [ ] [Measure to prevent recurrence]
- [ ] [Updated monitoring/alerting]

### Lessons Learned

[What can we do better next time?]
```

### Distribution

- Store in `docs/incidents/YYYY-MM-DD-<slug>.md`
- Brief stakeholders within 72 hours
- Update `SECURITY.md` if disclosure scope expands
