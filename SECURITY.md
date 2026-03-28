# Cendaro ERP Security Policy & Threat Model

At Cendaro, security is paramount. We view the protection of wholesale and retail commercial data as our highest operational mandate. This document outlines our vulnerability disclosure process, threat model, and established SLAs.

---

## 🛡️ Supported Versions

We enforce a rolling-release cycle. We actively audit and backport security patches **only** to the latest production commit on the `main` branch.

| Branch/Version | Supported          | Vulnerability Status |
| -------------- | ------------------ | -------------------- |
| `main`         | :white_check_mark: | Highly Active        |
| Older branches | :x:                | Deprecated           |

---

## 🚨 Vulnerability Reporting Workflow

Under no circumstances should security vulnerabilities be disclosed via public GitHub Issues, Discussions, or Pull Requests.

If you suspect you have identified a critical vulnerability, please escalate it directly to our infrastructure security team:
**Email:** `security@cendaro.com`

**Your report should ideally encompass:**

- **Description:** Clear articulation of the vulnerability (e.g., SQLi, XSS, RCE, Broken Access Control).
- **Reproduction Steps:** Sequential instructions to replicate the behavior.
- **Impact Assessment:** A realistic evaluation of data exposure or privilege escalation potential.
- **Mitigation Proposal:** (Optional but highly appreciated) recommended architectural fixes.

### Response SLA

- **Acknowledgment:** Within 48 hours.
- **Triage & Assessment:** Within 72 hours.
- **Patch/Release:** Highly dependent on severity (target of < 5 days for P0/Critical).

---

## 🔒 Threat Model & Out-of-Scope Vulnerabilities

Cendaro ERP employs a hardened, multi-tier defense architecture:

1. **Authentication:** Operated entirely via Supabase Auth SSR leveraging strictly `HTTPOnly` and `SameSite=Lax` cookies.
2. **Authorization:** Validated at the edge via Next.js middleware and resolved by tRPC `workspaceProcedure` utilizing a strict 6-tier RBAC system (`owner` > `admin` > `supervisor` > `employee`).
3. **Data Isolation (RLS):** Supabase PostgreSQL Row-Level Security explicitly enforces isolation boundaries. Edge requests inject a `SET LOCAL app.workspace_id` to strictly limit query perimeters.
4. **Injection Protection:** All data ingestion is systematically sanitized through `Drizzle ORM` parameterized queries and `zod` schema validations.

### 🚫 Out of Scope

The following theoretical attack vectors are considered accepted risks or out of scope for our bug bounty and reporting program:

- Volumetric/Distributed Denial of Service (DDoS) attacks.
- Social engineering (phishing, vishing) targeting Cendaro's developers or employees.
- Missing rate limits on non-authentication endpoints (unless demonstrating an immediate data-leak).
- Theoretical CSRF vulnerabilities decoupled from verified session hijacking parameters.
