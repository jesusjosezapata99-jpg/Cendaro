---
trigger: always_on
---

# Epistemic Memory — Always-On Directives

## Knowledge File Map

Read these files at session start and before code changes (order matters):

| File                                                | When                                                              |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| `.agents/skills/omni-epistemic-memory/error-log.md` | **Every session start** — focus on Quick Reference table          |
| `.gemini/rules.md`                                  | Every session start — Forbidden Actions + Error Prevention Matrix |
| `.gemini/knowledge/architecture.md`                 | Before architectural or structural changes                        |
| `.gemini/knowledge/stack.md`                        | Before adding or changing dependencies                            |
| `.gemini/knowledge/state.md`                        | When picking up from a previous session                           |

## Pattern Interruption Protocol

If during execution you detect you are about to produce a pattern that matches a known error in the Quick Reference table or Error Prevention Matrix:

1. **STOP** — do not proceed with the error-prone approach
2. Read the full entry for the matching pattern in `error-log.md`
3. Apply the documented prevention rule exactly
4. Log the interruption in the session summary

This is not optional. A repeated error that was already documented is a system failure.

## Error Log Write Failure

If you cannot write to `error-log.md` (file locked, permissions, git conflict):

1. Warn the user immediately with the exact error
2. Output the complete formatted entry to the conversation for manual pasting
3. Continue with the task — do not block on the write failure
