# LTX-2 Video Pre-Rendering Pipeline

Pre-renders cinematic AI video assets via the [Lightricks LTX Cloud API](https://console.ltx.video/).

## Quick Start

```powershell
# Dry run (no API calls)
pnpm exec dotenv -e apps/erp/.env.local -- node scripts/ltx-2/generate-videos.mjs --dry-run

# Generate all videos
pnpm exec dotenv -e apps/erp/.env.local -- node scripts/ltx-2/generate-videos.mjs

# Generate a single video
pnpm exec dotenv -e apps/erp/.env.local -- node scripts/ltx-2/generate-videos.mjs --only hero-cinematic

# Override model
pnpm exec dotenv -e apps/erp/.env.local -- node scripts/ltx-2/generate-videos.mjs --model ltx-2-3-pro
```

## Files

| File                  | Purpose                                     |
| --------------------- | ------------------------------------------- |
| `generate-videos.mjs` | Node.js generation pipeline                 |
| `prompts.json`        | Prompt configuration (screenwriting format) |

## Environment

| Variable      | Source                | Required |
| ------------- | --------------------- | -------- |
| `LTX_API_KEY` | `apps/erp/.env.local` | ✅       |

## Budget

| Model          | Resolution | Cost/second |
| -------------- | ---------- | ----------- |
| `ltx-2-3-fast` | 1080p      | $0.04       |
| `ltx-2-3-pro`  | 1080p      | $0.08       |

Output: `apps/erp/public/videos/`
