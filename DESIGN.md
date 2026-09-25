# Cendaro ERP — Design System & Visual Grammar

> Single source of truth for UI/UX across all AI coding assistants (Claude Code, Antigravity, Codex). Method: **Impeccable** (direction, craft floor) + **UI UX Pro Max** (UX, motion and performance rules).
> Tokens live in `tooling/tailwind/theme.css`; this file describes them and never overrides them.
> Enforced by `scripts/checks/design-guard.mjs` (patterns) and `scripts/checks/contrast.mjs` (WCAG). Product truth: `PRODUCT.md`.

---

## 1. Identity & Principles

- **Archetype**: Monochrome Precision SaaS / High-Contrast Enterprise Grid. Reference: midday.ai. Benchmark: Linear meets Bloomberg Terminal.
- **Color carries meaning, never decoration.** The interface is greyscale; color appears only as status, focus, alerts — and, on public pages, only inside the product recordings.
- **Radius 0** (`--radius: 0rem`) everywhere. `rounded-full` only on status pills and circular avatars.
- **Hairlines, not shadows.** Structure comes from 1px `border-border` rules. Shadows exist only in `packages/ui/src` overlay primitives (`shadow-md` on dialog, sheet, dropdown, popover).
- **Numbers are first-class.** Money and quantities are tabular, aligned, formatted `es-VE`.
- **Two modes, one grammar.** _Operate_ (the app: density, scanability) and _Persuade_ (public pages: scale, rhythm, restraint) share tokens, type and motion.

---

## 2. Color

All pairs are calibrated to WCAG AA (4.5:1 text, 3:1 UI). Use token classes (`bg-background`, `text-muted-foreground`, `border-border`, `bg-status-success-bg`…). A raw hex/rgb literal in `apps/erp/src` fails the guard; add a token to `theme.css` first.

| Token                | Light                   | Dark                     | Role                                                                                     |
| :------------------- | :---------------------- | :----------------------- | :--------------------------------------------------------------------------------------- |
| `--background`       | `hsl(0 0% 100%)`        | `hsl(0 0% 5%)`           | Canvas                                                                                   |
| `--foreground`       | `hsl(0 0% 7%)`          | `hsl(0 0% 98%)`          | Primary text, primary button fill                                                        |
| `--card`             | `hsl(45 18% 96%)`       | `hsl(0 0% 7%)`           | Raised panels, frame chrome                                                              |
| `--muted`            | `hsl(40 11% 89%)`       | `hsl(0 0% 11%)`          | Quiet fills, hover rows, gradient ends                                                   |
| `--muted-foreground` | `hsl(0 0% 38%)` (6.2:1) | `hsl(0 0% 53%)` (5.44:1) | Secondary text — the lowest text contrast allowed; never add `/60`-style opacity to text |
| `--border`           | `hsl(45 5% 85%)`        | `hsl(0 0% 11%)`          | 1px hairlines                                                                            |
| `--ring`             | `hsl(240 5.9% 10%)`     | `hsl(240 4.9% 83.9%)`    | Focus rings                                                                              |
| `--destructive`      | `hsl(0 84.2% 48%)`      | `hsl(359 100% 44%)`      | Errors, destructive actions                                                              |
| `--sheet`            | `#fafaf9`               | `#0c0c0c`                | Sheet surface                                                                            |

### Status tones (meaning only)

Always `getStatus(domain, value)` (`apps/erp/src/lib/status.ts`) + `StatusPill` (`@cendaro/ui/status-pill`). Never an inline `STATUS_CONFIG`.

| Tone        | Light FG / BG                       | Dark FG   | Meaning                 |
| :---------- | :---------------------------------- | :-------- | :---------------------- |
| Neutral     | `#616161` / `#f2f1ef`               | `#878787` | Draft, inactive         |
| Success     | `#007a3d` / `#ddf1e4`               | `#00c969` | Paid, delivered, active |
| Warning     | `#8a6500` / `rgb(255 208 43 / 0.1)` | `#ffd02b` | Pending, low stock      |
| Info        | `#1a56c4` / `#ddebff`               | `#4c8dff` | In transit, processing  |
| Orange      | `#b4470a` / `#ffedd5`               | `#f97316` | Refunded, partial       |
| Destructive | `#c21f21` / `rgb(255 54 56 / 0.1)`  | `#ff3638` | Cancelled, failed, void |

---

## 3. Typography

Loaded with `next/font` in `apps/erp/src/app/layout.tsx`:

- **Hedvig Letters Sans** (`font-sans`, preloaded) — all UI and body text.
- **Hedvig Letters Serif** (`font-serif`, not preloaded) — display headings: page titles, public headlines.
- **Geist Mono** (`font-mono`, not preloaded) — tabular figures, SKUs, invoice numbers, eyebrows and indices on public pages.

**Weight**: Hedvig ships **400 only**. `font-medium` is the heaviest allowed class; `font-semibold/bold/extrabold` are banned (Chrome synthesizes a fake bold). Hierarchy = size + color + space.

| Style    | App (Operate)                                                        | Public (Persuade)                                                                                            |
| :------- | :------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| Display  | —                                                                    | `font-serif text-[clamp(2.75rem,6vw,5.5rem)] leading-[1.02] tracking-[-0.025em] text-balance` (hero h1)      |
| Title    | `font-serif text-2xl tracking-tight`                                 | `font-serif text-[clamp(2rem,3.5vw,3rem)] leading-[1.08] tracking-[-0.02em] text-balance` (h2)               |
| Subtitle | `text-lg font-medium`                                                | `font-serif text-2xl leading-tight` (h3 / steps)                                                             |
| Lead     | —                                                                    | `text-lg leading-relaxed text-muted-foreground text-pretty`, max 60ch                                        |
| Body     | `text-sm`                                                            | `text-base leading-relaxed`                                                                                  |
| Eyebrow  | `text-xs uppercase font-medium tracking-wider text-muted-foreground` | `font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground` with index `01 —` in `text-foreground` |
| Figures  | `font-mono tabular-nums`                                             | same                                                                                                         |

Minimum text size 12px (`text-xs`) and only for meta. Line length 45–75ch for reading text.

---

## 4. Space, Grid & Breakpoints

- **Scale**: Tailwind 4 spacing (`--spacing: 0.25rem`). App density: 8–32px. Public rhythm: section padding `py-24 md:py-32`, heading → content `mt-12 md:mt-16`, cards `p-6 md:p-8`.
- **Container**: `mx-auto max-w-7xl px-4 sm:px-6` (16px gutter on phones, never horizontal scroll at 320px).
- **Grid**: 12 columns on desktop for public layouts; common splits `5fr/7fr` (text/product), `1fr×3`, `1fr×4`. Cells separated by hairlines (`divide-x divide-border` / `gap-px bg-border`), not by gaps with shadows.
- **Breakpoints**: `sm 640 · md 768 · lg 1024 · xl 1280`. Phone < 768 gets stacked layouts, tabs instead of sticky scroll, portrait recordings.
- **Touch targets** ≥ 44×44px (`max-md:min-h-11` is built into `buttonVariants`).

---

## 5. Icons

Only `Icons` / `Icon` from `@cendaro/ui/icons` (auto-generated set: Material Design + Material Symbols Outlined; regenerate with `pnpm -F @cendaro/ui icons`). Static → `<Icons.Pascal />`; dynamic → `<Icon name={value as IconName} />`. Sizes `size-4` inline, `size-5` in nav, `size-6` in feature cells inside a 1px square frame (`size-12 border`). No `lucide-react`, Heroicons, FontAwesome, `material-symbols-outlined` spans or emojis. Third-party brand marks (WhatsApp) are inline SVG, `aria-hidden` (`primitives/whatsapp-mark.tsx`).

---

## 6. Motion

Runtime: `LazyMotion` + `domAnimation` + `MotionConfig reducedMotion="user"` (`apps/erp/src/components/motion-provider.tsx`); `m.` components only.

| Token             | Value                           | Use                          |
| :---------------- | :------------------------------ | :--------------------------- |
| `--motion-micro`  | 150 ms                          | Hover, focus, press          |
| `--motion-ui`     | 250 ms                          | Menus, accordions, tabs      |
| `--motion-enter`  | 600 ms                          | Section entrance             |
| `--motion-media`  | 450 ms                          | Crossfade between recordings |
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Default                      |

Rules:

1. Animate only `transform` and `opacity`. `filter: blur` only on headlines (≤ 4px), never on media or large containers. Never width/height/top/left.
2. At most two elements animating at once per viewport; stagger ≤ 60 ms and ≤ 6 siblings.
3. Entrances once; exits faster than entrances; no scroll-jacking; no parallax on phones.
4. Every animation has a reduced-motion final state; recordings fall back to posters.
5. Motion explains (state change, continuity), never decorates.

Public-site choreography (implemented in `apps/erp/src/app/_components/landing/primitives/` and `globals.css`):

- **Reveal**: `<Reveal variant="up|fade|rise">` renders `data-reveal`; one shared `IntersectionObserver` (`RevealObserver`) sets `data-inview`. Hidden start state only under `html.js-reveal` (inline bootstrap), 3 s failsafe, content visible without JS.
- **Hero headline**: `animate-hero-line` — transform-only, the `<h1>` is painted on the first frame (it is the LCP element).
- **Product frames**: `rise` (24px + scale .98 → 1).
- **Sticky steps**: one sticky frame, recordings stacked and crossfaded (`--motion-media`), progress hairline filled with scroll.

---

## 7. Components — Public Surfaces

| Component        | Spec                                                                                                                                       |
| :--------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| Primary button   | `buttonVariants({ size: "lg" })` + `h-11 px-6`; fill `foreground` on `background` text; press `translate-y-px`; focus ring `--ring`        |
| Secondary button | `buttonVariants({ variant: "outline", size: "lg" })` + `h-11 px-6`                                                                         |
| CTA group        | `CtaButtons`: "Solicitar acceso" (WhatsApp → email) + "Iniciar sesión"; degrades to login only when no channel is configured               |
| Product frame    | `ProductFrame`: 1px border, `h-9` chrome in `bg-card` with three 8px squares and the app URL in mono                                       |
| Backdrop         | `GrainBackdrop`: diagonal token gradient `from-muted via-card to-background` + 12 KB grain tile                                            |
| Recording        | `LandingVideo`: fixed aspect ratio, theme posters as CSS backgrounds, AV1 → H.264, attaches near viewport, plays ≥ 35 % visible            |
| Section heading  | `SectionHeading`: mono eyebrow with index, serif title, muted lead; centered or start-aligned                                              |
| Feature cell     | Icon in a `size-12` 1px square, title `text-base font-medium`, one-line description `text-sm text-muted-foreground`; cells share hairlines |
| Pill             | `rounded-full border px-3 py-1 text-xs` — the only rounded element on public pages                                                         |

---

## 8. Imagery & Product Recordings

- The product is the imagery. No stock photos, illustrations of people, 3D or gradients with hue.
- Recordings of the real app (`scripts/landing-media/`): 1440×900 wide and 390×844 portrait, 30 fps, 8–14 s, first and last frame identical for a seamless loop, both themes, fictitious Venezuelan demo data only (never production customer data).
- Encoding: AV1 WebM (primary) + H.264 MP4 faststart (fallback), widths 1440/960/720; AVIF posters; content-hashed paths under `/media/landing/<hash>/`, served `immutable`.
- A synthetic cursor (1px outlined square, no color) may guide the eye; no zoom-and-pan effects.

---

## 9. Accessibility (floor, not goal)

WCAG 2.2 AA: contrast per §2; visible focus on every interactive element; skip link on public pages; one `<h1>` per page and no skipped heading levels; icon-only buttons have `aria-label`; decorative media `aria-hidden` with a textual equivalent nearby; keyboard-operable menus (Esc closes, focus returns); no content conveyed by color alone; usable at 200 % zoom and 320px width; `prefers-reduced-motion` and Save-Data respected.

---

## 10. Performance Budgets (public pages)

Lighthouse mobile Performance ≥ 95 (hard floor 90), Accessibility/Best Practices/SEO 100; LCP < 2.0 s on slow 4G (the LCP is the headline, never media); CLS < 0.02; TBT < 150 ms; route client JS ≤ 45 KB gz; bytes before interaction ≤ 350 KB; recording ≤ 450 KB (AV1) per clip; poster ≤ 45 KB. Marketing routes are static (no dynamic segments). Details: `~/.claude/plans/PLAN-2026-09-LANDING-REDESIGN.md` §5.

---

## 11. Content Rules

Copy lives in `apps/erp/src/app/_components/landing/content.ts`; every factual claim carries its source (repo path or dated owner decision). Voice and lexicon: `PRODUCT.md` → Voice. Never publish testimonials, metrics, prices, seals or integrations that do not exist; `content.guard.test.ts` fails on known-false phrases.

---

## 12. Anti-Patterns (strict)

1. ❌ Decorative gradients with hue, purple/pink "AI" glows, glassmorphism.
2. ❌ `rounded-sm/md/lg/xl/2xl/3xl` on anything; `rounded-full` outside pills and avatars.
3. ❌ Text below `--muted-foreground` contrast, or opacity modifiers on text.
4. ❌ Double padding: container padding and component padding never stack.
5. ❌ Layout shift: reserve dimensions for media, badges, avatars and async cells.
6. ❌ `font-semibold` / `font-bold` (fake bold).
7. ❌ Inline status maps (`STATUS_CONFIG`).
8. ❌ Emoji or third-party icon sets in UI.
9. ❌ Animations on layout properties; content hidden until JavaScript runs.
10. ❌ Two sections with the same message; generic headlines ("Todo lo que necesitas") without a concrete claim.
