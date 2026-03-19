# Sync Protocols — Exact Format Templates

All templates in this file are authoritative. Copy them exactly — do not paraphrase or restructure.

---

## A — state.md Progress Log Entry

**File**: `.gemini/knowledge/state.md`  
**Operation**: Prepend to the Progress Log section. Do not append — entries go newest-first.  
**Also update**: Session Count (increment by 1) + Last Modified By field.

```markdown
### [YYYY-MM-DDThh:mm:ss+hh:mm] — [Brief Title of What Was Done]

**What**: [2–4 sentence description of the change, decision, or fix. Be specific — file names, procedure names, counts. Future agents depend on this being precise.]

**Files changed**:

- `[path/to/file.ts]` — [one-line description of what changed]
- `[path/to/file.ts]` — [one-line description of what changed]

**Decisions**: [Any architectural or design decisions made and why. Omit if none.]

**Verification**: `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅

**Health**: ✅ Operational
```

**Minimal variant** (for documentation-only or config-only changes with no code):

```markdown
### [YYYY-MM-DDThh:mm:ss+hh:mm] — [Brief Title]

**What**: [Description]
**Files changed**: `[file]`
**Verification**: Document only — no code changes.
```

---

## B — error-log.md Entry

**File**: `.agents/skills/omni-epistemic-memory/error-log.md`  
**Operation**: Append new entry to the Entries section. Also update Quick Reference table + Statistics.

### Full entry format:

```markdown
### [YYYY-MM-DD] [Brief Title — action verb + noun]

- **Error**: [Exact description of what failed — include error message if available]
- **Root Cause**: [Why it failed — classify: Local (workspace) / Global (monorepo-wide) / Platform (Windows)]
- **Fix**: [What was done to resolve it — specific, not generic]
- **Prevention**: [The rule that prevents recurrence — must be actionable and specific]
- **Workspace**: [Package(s) affected — e.g., "Root monorepo" or "@cendaro/erp" or "@cendaro/api"]
- **Severity**: [Critical (build-breaking) / Major (feature-breaking) / Minor (DX or cosmetic)]
- **Recurrence**: [1st — or Nth if it matches an existing Quick Reference rule, cite rule #N]
```

### Quick Reference table row format:

```markdown
| [N] | [One-line prevention rule — verb + constraint] | [Context tag] |
```

### Statistics section — update these fields:

```markdown
| **Total entries** | [N] |
| **Critical** | [N] |
| **Major** | [N] |
| **Minor** | [N] |
| **Most common workspace** | [Workspace (N/Total entries)] |
| **Date of last entry** | [YYYY-MM-DD] |
| **Quick Reference rules** | [N] |
```

---

## C — architecture.md Update

**File**: `.gemini/knowledge/architecture.md`  
**Operation**: Update the relevant section. Always update Mermaid diagrams if topology changed.

When adding a new package:

- Add to the `graph TB` diagram under the appropriate subgraph
- Add a Package Description section with the same structure as existing packages
- Add to the Dependency Graph (`graph LR`) with correct arrows
- Update "Key observations" if the dependency pattern changes

When adding a new route group in `apps/erp/src/app/(app)/`:

- Update the `@cendaro/erp` package description under `src/app/(app)/`
- Note: route count in README.md may also need updating → trigger `/prd-sync`

When adding a new tRPC router:

- Update the `@cendaro/api` router module count and list
- Update the Dependency Graph if new inter-package dependencies were introduced

When adding a new external service:

- Add to the `External Services` subgraph in the main diagram
- Add connection arrows from the appropriate package
- Add to the Environment Variables table if it requires new env vars

---

## D — stack.md Update

**File**: `.gemini/knowledge/stack.md`  
**Rule**: NEVER guess versions. Always read from `package.json` or `pnpm-workspace.yaml` catalog.

When adding a new dependency:

```markdown
| **[Category]** | [Technology name] | [^x.y.z from package.json] | [One-line usage description] |
```

When updating an existing dependency version:

- Find the existing row and update only the Version column
- Add a note to the Dependency Change Log section in `state.md`

When removing a dependency:

- Remove the row entirely
- The rule at the bottom of stack.md reads: "If a technology is NOT listed in this table, it does NOT exist in this project."

---

## E — Rules Update (Error Prevention Matrix sync)

**File**: `.gemini/rules.md`  
**Section**: Error Prevention Matrix table  
**Operation**: Add a new row. Keep all 3 matrices in sync (error-log.md Quick Reference + rules.md Error Prevention Matrix).

```markdown
| [Error Pattern description] | [Root Cause] | [Prevention Rule — specific and actionable] |
```

**Sync check**: After updating, verify that:

1. The error-log.md Quick Reference table has the corresponding rule
2. The rules.md Error Prevention Matrix has the corresponding rule
3. Both descriptions are consistent (not contradictory)

---

## Error Log Write Failure — Manual Paste Template

If the agent cannot write to `error-log.md`, output this to the conversation for manual pasting:

```
⚠️ WRITE FAILURE — MANUAL ACTION REQUIRED
Could not write to: .agents/skills/omni-epistemic-memory/error-log.md
Reason: [exact error message]

Paste the following entry manually:

---
[Complete formatted entry using the template above]
---

Also add this row to the Quick Reference table:
| [N]  | [Prevention rule]  | [Context]  |

And update Statistics:
- Total entries: [N+1]
- [Severity]: [N+1]
- Date of last entry: [YYYY-MM-DD]
- Quick Reference rules: [N+1 if new pattern]
```
