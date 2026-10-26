---
description: Load a lean picture of the project's current state (recent commits, recent sessions, graph freshness) without reading large files.
---

Build a short picture of where the project stands, spending as few tokens as possible:

1. Run `git status --short` and `git log --oneline -15` to see the branch, pending changes and recent work.
2. Search claude-mem for the most recent sessions of project `TEST` (use the `mem-search` / `timeline` tools with `project: "TEST"`).
3. Read only the `## Summary` and `## Graph Freshness` sections of `graphify-out/GRAPH_REPORT.md` (not the whole file), and compare the graph's commit with `git rev-parse --short HEAD`. If they differ, say so and suggest `graphify update .`.
4. If the user named a topic ($ARGUMENTS), run `graphify query "$ARGUMENTS"` for it.

Do not read `.gemini/knowledge/archive/` (retired history) or the full `GRAPH_REPORT.md`. Read `.gemini/knowledge/architecture.md` or `stack.md` only if the task is about structure or dependencies.

Finish with a summary of at most 10 lines: branch and pending changes, what the last sessions did, graph freshness, and anything that needs attention.
