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

## 🔒 Threat Model & Security Architecture

Cendaro ERP employs a hardened, multi-tier defense-in-depth architecture:

| Layer                   | Controls                                                                    |
| ----------------------- | --------------------------------------------------------------------------- |
| **Edge (Proxy)**        | Rate limiting (IP + username), AAL2 enforcement, security headers, X-Robots |
| **API (Route Handler)** | Zod validation, constant-time auth, body-size caps, CSRF origin checks      |
| **tRPC (Middleware)**   | RBAC (6-tier), workspace isolation via `SET LOCAL`, session verification    |
| **Database (RLS)**      | Row-Level Security, `app.workspace_id` scoping, parameterized queries       |
| **Transport**           | HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy         |
| **Authentication**      | MFA/TOTP (mandatory admin), dual-vector rate limiter, timing oracle defense |

### Key Security Controls

1. **MFA/TOTP**: Mandatory for `owner` and `admin` roles. TOTP enrollment is forced on first login for unprivileged admin accounts.
2. **Constant-Time Auth**: Login responses take identical time regardless of whether the username exists (timing oracle mitigation).
3. **Dual-Vector Rate Limiting**: Per-IP (5/60s) + per-username (10/15min) with 15-minute hard lockout after 8 failures.
4. **Content Security Policy**: Strict CSP header limiting script/style/connect sources.
5. **Session Hardening**: `HTTPOnly`, `SameSite=Lax` cookies via Supabase SSR. Proxy enforces AAL2 for MFA-enrolled users.

### 🚫 Out of Scope

The following are out of scope for our vulnerability reporting program:

- Volumetric/Distributed Denial of Service (DDoS) attacks
- Social engineering targeting developers or employees
- Issues in third-party infrastructure (Supabase platform, Vercel CDN)
- Theoretical vulnerabilities without proven exploitability
- Issues requiring physical device access

---

## 🤝 Safe Harbor

We support responsible security research. Researchers who:

- Act in good faith and avoid damaging the service
- Do not access or modify other users' data
- Report issues promptly and privately

Will **not** face legal action. We will work collaboratively to resolve verified issues and credit researchers in release notes (unless anonymity is preferred).
