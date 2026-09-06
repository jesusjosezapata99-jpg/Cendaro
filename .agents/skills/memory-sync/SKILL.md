---
name: memory-sync
description: >
  Synchronize living memory after completing significant tasks. Use after
  code changes, bug fixes, architecture modifications, or dependency updates.
  Also use when the user says "sync memory", "update state", or "save context".
allowed-tools: Read, Write, Edit, Bash(graphify *)
---

# Post-Task Memory Synchronization

After completing any significant task, perform ALL applicable actions:

## 1. Always — Update State (MANDATORY)

Prepend a timestamped entry to `.gemini/knowledge/state.md`:

```markdown
## [YYYY-MM-DDTHH:MMZ] [Task Title]

- **Scope**: Brief description of what was done
- **Files changed**: List of key files modified
- **Decisions made**: Any architectural or design decisions
- **Next steps**: If applicable
```

## 2. On Structural Changes

If you created new packages, routes, modules, services, or significantly reorganized code:

- Update `.gemini/knowledge/architecture.md` with the new structure

## 3. On Dependency Changes

If you added, removed, or updated dependencies:

- Update `.gemini/knowledge/stack.md` with new versions
- **Verify from `package.json`** — never guess versions

## 4. On Knowledge Graph Impact

If you modified code files that affect the architecture:

```bash
graphify update .
```

## 5. Confirm Completion

Report what was synced:

- ✅ state.md updated
- ✅/⏭️ architecture.md (updated / not needed)
- ✅/⏭️ stack.md (updated / not needed)
- ✅/⏭️ graphify (updated / not needed)
