---
name: project-skills
description: >
  Master catalog of all SvartxLab project skills. Lists 90+ skills across
  .claude/skills/, .agents/skills/, and .opencode/skills/ directories. Use when
  the user asks "what skills are available", "list skills", "find a skill for X",
  or when you need specialized knowledge for a task.
---

# SvartxLab — Project Skills Catalog

This project has **90+ specialized skills** across multiple directories. Load any skill by reading its `SKILL.md` file.

---

## Marketing Skills v2.0 — `.claude/skills/` (40 skills)

From [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) v2.0.0.
All skills check `.agents/product-marketing.md` for context before executing.

### Foundation

| Skill             | Path                                        | Use When                                            |
| :---------------- | :------------------------------------------ | :-------------------------------------------------- |
| product-marketing | `.claude/skills/product-marketing/SKILL.md` | Create/update ICP, positioning, brand voice context |

### Conversion Optimization

| Skill      | Path                                 | Use When                            |
| :--------- | :----------------------------------- | :---------------------------------- |
| cro        | `.claude/skills/cro/SKILL.md`        | Page & form conversion optimization |
| signup     | `.claude/skills/signup/SKILL.md`     | Registration flow optimization      |
| onboarding | `.claude/skills/onboarding/SKILL.md` | Post-signup activation flows        |
| popups     | `.claude/skills/popups/SKILL.md`     | Modals, overlays, banners           |
| paywalls   | `.claude/skills/paywalls/SKILL.md`   | In-app upgrade moments              |

### Content & Copy

| Skill        | Path                                   | Use When                              |
| :----------- | :------------------------------------- | :------------------------------------ |
| copywriting  | `.claude/skills/copywriting/SKILL.md`  | Marketing page copy                   |
| copy-editing | `.claude/skills/copy-editing/SKILL.md` | Edit/review existing copy             |
| cold-email   | `.claude/skills/cold-email/SKILL.md`   | B2B cold outreach & sequences         |
| emails       | `.claude/skills/emails/SKILL.md`       | Automated email flows, drip campaigns |
| social       | `.claude/skills/social/SKILL.md`       | Social media content                  |
| image        | `.claude/skills/image/SKILL.md`        | AI image generation for marketing     |
| video        | `.claude/skills/video/SKILL.md`        | Video production with AI tools        |

### SEO & Discovery

| Skill             | Path                                        | Use When                                |
| :---------------- | :------------------------------------------ | :-------------------------------------- |
| seo-audit         | `.claude/skills/seo-audit/SKILL.md`         | Technical & on-page SEO audits          |
| ai-seo            | `.claude/skills/ai-seo/SKILL.md`            | AI search optimization (AEO, GEO, LLMO) |
| programmatic-seo  | `.claude/skills/programmatic-seo/SKILL.md`  | Scaled page generation                  |
| site-architecture | `.claude/skills/site-architecture/SKILL.md` | Page hierarchy, navigation, URLs        |
| competitors       | `.claude/skills/competitors/SKILL.md`       | Comparison & alternative pages          |
| schema            | `.claude/skills/schema/SKILL.md`            | JSON-LD structured data                 |
| aso               | `.claude/skills/aso/SKILL.md`               | App Store Optimization                  |

### Paid & Distribution

| Skill       | Path                                  | Use When                            |
| :---------- | :------------------------------------ | :---------------------------------- |
| ads         | `.claude/skills/ads/SKILL.md`         | Google, Meta, LinkedIn ad campaigns |
| ad-creative | `.claude/skills/ad-creative/SKILL.md` | Bulk ad creative generation         |

### Measurement

| Skill      | Path                                 | Use When                        |
| :--------- | :----------------------------------- | :------------------------------ |
| analytics  | `.claude/skills/analytics/SKILL.md`  | GA4, GTM, event tracking setup  |
| ab-testing | `.claude/skills/ab-testing/SKILL.md` | Experiment design & methodology |

### Retention

| Skill            | Path                                       | Use When                           |
| :--------------- | :----------------------------------------- | :--------------------------------- |
| churn-prevention | `.claude/skills/churn-prevention/SKILL.md` | Cancel flows, save offers, dunning |

### Growth

| Skill                 | Path                                            | Use When                              |
| :-------------------- | :---------------------------------------------- | :------------------------------------ |
| co-marketing          | `.claude/skills/co-marketing/SKILL.md`          | Partner & joint campaigns             |
| free-tools            | `.claude/skills/free-tools/SKILL.md`            | Marketing tools & calculators         |
| referrals             | `.claude/skills/referrals/SKILL.md`             | Referral & affiliate programs         |
| directory-submissions | `.claude/skills/directory-submissions/SKILL.md` | Directory listing management          |
| lead-magnets          | `.claude/skills/lead-magnets/SKILL.md`          | Lead capture asset creation           |
| community-marketing   | `.claude/skills/community-marketing/SKILL.md`   | Community-led growth                  |
| customer-research     | `.claude/skills/customer-research/SKILL.md`     | Customer insight gathering            |
| competitor-profiling  | `.claude/skills/competitor-profiling/SKILL.md`  | Deep competitor analysis              |
| content-strategy      | `.claude/skills/content-strategy/SKILL.md`      | Content planning & editorial calendar |

### Strategy

| Skill                | Path                                           | Use When                         |
| :------------------- | :--------------------------------------------- | :------------------------------- |
| marketing-ideas      | `.claude/skills/marketing-ideas/SKILL.md`      | 140 SaaS marketing ideas         |
| marketing-psychology | `.claude/skills/marketing-psychology/SKILL.md` | Behavioral science in marketing  |
| launch               | `.claude/skills/launch/SKILL.md`               | Product launches & announcements |
| pricing              | `.claude/skills/pricing/SKILL.md`              | Pricing, packaging, monetization |

### Sales

| Skill            | Path                                       | Use When                              |
| :--------------- | :----------------------------------------- | :------------------------------------ |
| revops           | `.claude/skills/revops/SKILL.md`           | Lead lifecycle, scoring, pipeline     |
| sales-enablement | `.claude/skills/sales-enablement/SKILL.md` | Pitch decks, one-pagers, demo scripts |

### Tools Reference

| Resource           | Path                          | Contents                             |
| :----------------- | :---------------------------- | :----------------------------------- |
| Tool Registry      | `.claude/tools/REGISTRY.md`   | 80+ marketing tool integrations      |
| Integration Guides | `.claude/tools/integrations/` | API setup & common operations        |
| CLI Tools          | `.claude/tools/clis/`         | Zero-dep Node.js CLI wrappers        |
| Composio           | `.claude/tools/composio/`     | MCP integration layer for 500+ tools |

---

## Dev & Architecture Skills — `.agents/skills/` (27 skills)

### Development & Architecture

| Skill                            | Path                                                       | Use When                                       |
| :------------------------------- | :--------------------------------------------------------- | :--------------------------------------------- |
| next-best-practices              | `.agents/skills/next-best-practices/SKILL.md`              | File conventions, RSC, data patterns, metadata |
| next-cache-components            | `.agents/skills/next-cache-components/SKILL.md`            | PPR, `use cache`, cacheLife, cacheTag          |
| next-upgrade                     | `.agents/skills/next-upgrade/SKILL.md`                     | Upgrading Next.js versions                     |
| vercel-react-best-practices      | `.agents/skills/vercel-react-best-practices/SKILL.md`      | React/Next.js performance optimization         |
| shadcn-ui                        | `.agents/skills/shadcn-ui/SKILL.md`                        | shadcn/ui component integration                |
| stripe-best-practices            | `.agents/skills/stripe-best-practices/SKILL.md`            | Stripe integration patterns                    |
| upgrade-stripe                   | `.agents/skills/upgrade-stripe/SKILL.md`                   | Stripe API/SDK upgrades                        |
| supabase-postgres-best-practices | `.agents/skills/supabase-postgres-best-practices/SKILL.md` | Postgres optimization                          |

### Design & UI/UX

| Skill                 | Path                                            | Use When                             |
| :-------------------- | :---------------------------------------------- | :----------------------------------- |
| impeccable            | `.agents/skills/impeccable/SKILL.md`            | UI design, polish, critique, audit   |
| ui-ux-pro-max         | `.agents/skills/ui-ux-pro-max/SKILL.md`         | Design systems, palettes, typography |
| frontend-design       | `.agents/skills/frontend-design/SKILL.md`       | Production-grade frontend interfaces |
| web-design-guidelines | `.agents/skills/web-design-guidelines/SKILL.md` | Web Interface Guidelines compliance  |

### Email & Communications

| Skill       | Path                                  | Use When                   |
| :---------- | :------------------------------------ | :------------------------- |
| react-email | `.agents/skills/react-email/SKILL.md` | Email templates with React |
| resend      | `.agents/skills/resend/SKILL.md`      | Resend email platform      |

### Agent & Tooling

| Skill                       | Path                                                  | Use When                           |
| :-------------------------- | :---------------------------------------------------- | :--------------------------------- |
| gstack-pro                  | `.agents/skills/gstack-pro/SKILL.md`                  | 28-module dev workflow engine      |
| prompt-master               | `.agents/skills/prompt-master/SKILL.md`               | Prompt engineering for external AI |
| prompt-enhancer-antigravity | `.agents/skills/prompt-enhancer-antigravity/SKILL.md` | Auto prompt enhancement            |
| skill-creator               | `.agents/skills/skill-creator/SKILL.md`               | Create new Antigravity skills      |
| omni-epistemic-memory       | `.agents/skills/omni-epistemic-memory/SKILL.md`       | Self-learning agent protocol       |
| imagen                      | `.agents/skills/imagen/SKILL.md`                      | AI image generation                |
| pdf                         | `.agents/skills/pdf/SKILL.md`                         | PDF processing                     |

### Stitch & Design Tools

| Skill            | Path                                       | Use When                     |
| :--------------- | :----------------------------------------- | :--------------------------- |
| design-md        | `.agents/skills/design-md/SKILL.md`        | DESIGN.md synthesis          |
| enhance-prompt   | `.agents/skills/enhance-prompt/SKILL.md`   | Stitch prompt optimization   |
| react-components | `.agents/skills/react-components/SKILL.md` | Stitch → React conversion    |
| stitch-loop      | `.agents/skills/stitch-loop/SKILL.md`      | Iterative Stitch builds      |
| remotion         | `.agents/skills/remotion/SKILL.md`         | Walkthrough video generation |

---

## OpenCode Skills — `.opencode/skills/`

### Superpowers (14 skills) — `.opencode/skills/superpowers/`

| Skill                          | Path                                                                   |
| :----------------------------- | :--------------------------------------------------------------------- |
| using-superpowers              | `.opencode/skills/superpowers/using-superpowers/SKILL.md`              |
| writing-plans                  | `.opencode/skills/superpowers/writing-plans/SKILL.md`                  |
| executing-plans                | `.opencode/skills/superpowers/executing-plans/SKILL.md`                |
| writing-skills                 | `.opencode/skills/superpowers/writing-skills/SKILL.md`                 |
| systematic-debugging           | `.opencode/skills/superpowers/systematic-debugging/SKILL.md`           |
| test-driven-development        | `.opencode/skills/superpowers/test-driven-development/SKILL.md`        |
| receiving-code-review          | `.opencode/skills/superpowers/receiving-code-review/SKILL.md`          |
| requesting-code-review         | `.opencode/skills/superpowers/requesting-code-review/SKILL.md`         |
| brainstorming                  | `.opencode/skills/superpowers/brainstorming/SKILL.md`                  |
| dispatching-parallel-agents    | `.opencode/skills/superpowers/dispatching-parallel-agents/SKILL.md`    |
| subagent-driven-development    | `.opencode/skills/superpowers/subagent-driven-development/SKILL.md`    |
| verification-before-completion | `.opencode/skills/superpowers/verification-before-completion/SKILL.md` |
| finishing-a-development-branch | `.opencode/skills/superpowers/finishing-a-development-branch/SKILL.md` |
| using-git-worktrees            | `.opencode/skills/superpowers/using-git-worktrees/SKILL.md`            |

### ClaudeKit (5 skills) — `.opencode/skills/claudekit/`

| Skill               | Path                                                      |
| :------------------ | :-------------------------------------------------------- |
| context-engineering | `.opencode/skills/claudekit/context-engineering/SKILL.md` |
| problem-solving     | `.opencode/skills/claudekit/problem-solving/SKILL.md`     |
| web-testing         | `.opencode/skills/claudekit/web-testing/SKILL.md`         |
| mermaidjs-v11       | `.opencode/skills/claudekit/mermaidjs-v11/SKILL.md`       |
| docs-seeker         | `.opencode/skills/claudekit/docs-seeker/SKILL.md`         |

### Caveman (2 skills) — `.opencode/skills/caveman/`

| Skill          | Path                                               |
| :------------- | :------------------------------------------------- |
| caveman        | `.opencode/skills/caveman/caveman/SKILL.md`        |
| caveman-review | `.opencode/skills/caveman/caveman-review/SKILL.md` |

## How to Use

1. **Find the right skill** — scan the tables above by category
2. **Load it** — read the `SKILL.md` file at the listed path
3. **Follow its instructions** — each skill has specific procedures and rules
4. **Check references** — many marketing skills have `references/` subdirectories with deep supplemental docs
5. **Adapt tool references** — if a skill references tools you don't have, substitute equivalents:
   - `TodoWrite` → use a markdown checklist
   - `Task` with subagents → use Claude Code's native subagent system
   - `Read`, `Write`, `Edit`, `Bash` → your native tools
