---
name: landing-media-pipeline
description: Review gotchas for the landing video pipeline (encode.mjs, build-manifest.mjs, media.ts, video-policy AV1_TYPE, media.guard budgets)
metadata:
  type: project
---

Landing recordings pipeline (PLAN-2026-09-LANDING-REDESIGN): scripts/landing-media/encode.mjs -> build-manifest.mjs -> generated apps/erp/src/app/_components/landing/media.ts + public/media/landing/<hash8>/.

Gotchas found in the 2026-09-27 F9 review (verify they still hold before citing):

- `AV1_TYPE` in primitives/video-policy.ts is a single static codec string (level 4.0, `av01.0.08M.08`); renditions wider than ~2048 px are AV1 level 5.0 (seq_level_idx 12). Check with `ffprobe -show_entries stream=level` whenever widths change.
- AV1 files were often LARGER than the H.264 ones at the chosen CRF pairs, so AV1-first served more bytes. Compare sizes per rendition, not just against the budget.
- media.guard.test.ts byte budgets had 2-4x headroom over real files and cannot detect quality regressions (blur makes files smaller). Treat it as a smoke test.
- build-manifest.mjs writes media.ts as JSON (quoted keys), so it is not Prettier-clean until lint-staged runs; `.mjs` is NOT in the lint-staged glob and scripts/ is not covered by `pnpm format`.
- Encoded media (~47 MB per set) is committed to git without LFS; every re-encode adds a full new hash directory to history.

**Why:** these are not visible from the TS diff alone and recur whenever clips are re-encoded.
**How to apply:** on any landing-media review, probe the actual files (ffprobe is installed via winget) and compare codec level, sizes and budgets.
