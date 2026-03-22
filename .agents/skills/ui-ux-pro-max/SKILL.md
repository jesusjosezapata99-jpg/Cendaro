---
name: ui-ux-pro-max
description: >
  AI-powered design intelligence for building professional UI/UX. Generates
  complete design systems with industry-specific reasoning: 67 UI styles,
  161 color palettes, 57 font pairings, 161 industry reasoning rules, 24
  landing page patterns, 99 UX guidelines, and 25 chart types. Use when
  building landing pages, dashboards, web apps, or any UI that needs
  professional styling, color selection, typography, layout patterns, or
  UX review. Also use for accessibility audits, dark mode design, animation
  guidelines, and responsive layout best practices.
---

# UI/UX Pro Max — Design Intelligence

> v2.0 — Adapted for Antigravity IDE + Claude Opus 4.6 Thinking
> Based on [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT License)

---

## When to Apply

| Priority        | When                                                     | Examples                                                              |
| --------------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| **Must Use**    | Creating any new page, component, or visual interface    | "Build a landing page", "Create a pricing card", "Design a dashboard" |
| **Recommended** | Choosing colors, fonts, styles, or reviewing existing UI | "What style fits a fintech app?", "Review this page for UX issues"    |
| **Skip**        | Pure backend logic, API endpoints, database queries      | "Add a tRPC mutation", "Fix the SQL query"                            |

---

## Rule Categories by Priority

| Priority | Category            | Impact          | Key Checks                                           | Anti-Pattern                           |
| -------- | ------------------- | --------------- | ---------------------------------------------------- | -------------------------------------- |
| CRITICAL | Accessibility       | Legal + ethical | WCAG AA 4.5:1, focus visible, aria labels            | Color-only meaning, no focus states    |
| CRITICAL | Touch & Interaction | Core UX         | 44pt+ targets, cursor-pointer, hover states          | Tiny targets, no feedback, emoji icons |
| HIGH     | Performance         | Speed + CWV     | WebP/AVIF, lazy load, code splitting, CLS            | Large unoptimized images, layout shift |
| HIGH     | Style Selection     | Brand + UX      | Style matches product type, consistent design tokens | Random style mixing, no design system  |
| HIGH     | Layout & Responsive | Access + UX     | Mobile-first, breakpoints, viewport units            | Horizontal scroll, fixed 100vh         |
| HIGH     | Navigation Patterns | Wayfinding      | Bottom nav ≤5, back behavior, deep links             | Mixed patterns, hidden nav             |
| MEDIUM   | Typography & Color  | Readability     | 1.5+ line height, type scale, semantic tokens        | Low contrast, random hex values        |
| MEDIUM   | Animation           | Engagement      | 150-300ms, transform/opacity only, reduced-motion    | >500ms, animating width/height         |
| MEDIUM   | Forms & Feedback    | Conversion      | Visible labels, inline validation, error recovery    | Placeholder-only, no loading state     |
| LOW      | Charts & Data       | Insight         | Chart type matches data, accessible palette          | Pie for >5 categories, color-only      |

---

## Quick Reference

### 1. Accessibility (CRITICAL)

- `focus-visible` - All interactive elements show visible focus ring (keyboard)
- `alt-text` - All images have descriptive alt text
- `aria-labels` - All icon-only buttons have aria-label
- `contrast-ratio` - Text: 4.5:1 minimum, large text: 3:1 minimum (WCAG AA)
- `keyboard-nav` - All interactive elements reachable and operable via keyboard
- `reduced-motion` - Respect `prefers-reduced-motion: reduce` (disable or simplify animations)
- `screen-reader-order` - DOM order matches visual order
- `color-not-only` - Never use color alone to convey meaning (add icon/text)
- `heading-hierarchy` - Use h1 → h2 → h3 in order, no skips
- `link-purpose` - Link text describes destination (not "click here")
- `error-a11y` - Form errors announced to screen readers via `aria-live` or `role="alert"`
- `skip-link` - Provide "Skip to content" link for keyboard users

### 2. Touch & Interaction (CRITICAL)

- `cursor-pointer` - All clickable elements must have cursor: pointer
- `hover-states` - All interactive elements must have visible hover state
- `touch-target-size` - Minimum 44×44px interactive area
- `tap-feedback` - Visual feedback within 100ms of interaction
- `no-emoji-icons` - Use SVG icons (Lucide, Heroicons), never emojis for structural UI
- `focus-ring` - Visible focus indicator for keyboard navigation
- `disabled-clarity` - Disabled elements: reduced opacity (0.38-0.5) + cursor change + semantic attribute
- `active-state` - Pressed/active state visually distinct from hover and default
- `scroll-snap` - Use scroll-snap for carousels and horizontal scrolling lists
- `gesture-conflict` - One primary gesture per region, avoid nested tap/drag conflicts

### 3. Performance (HIGH)

- `image-optimization` - Use WebP/AVIF, responsive images (srcset/sizes), lazy load non-critical assets
- `image-dimension` - Declare width/height or use aspect-ratio to prevent layout shift (Core Web Vitals: CLS)
- `font-loading` - Use font-display: swap/optional to avoid invisible text (FOIT); reserve space to reduce layout shift
- `font-preload` - Preload only critical fonts; avoid overusing preload on every variant
- `critical-css` - Prioritize above-the-fold CSS (inline critical CSS or early-loaded stylesheet)
- `lazy-loading` - Lazy load non-hero components via dynamic import / route-level splitting
- `bundle-splitting` - Split code by route/feature (React Suspense / Next.js dynamic) to reduce initial load and TTI
- `third-party-scripts` - Load third-party scripts async/defer; audit and remove unnecessary ones
- `reduce-reflows` - Avoid frequent layout reads/writes; batch DOM reads then writes
- `content-jumping` - Reserve space for async content to avoid layout jumps (Core Web Vitals: CLS)
- `lazy-load-below-fold` - Use loading="lazy" for below-the-fold images and heavy media
- `virtualize-lists` - Virtualize lists with 50+ items to improve memory efficiency and scroll performance
- `main-thread-budget` - Keep per-frame work under ~16ms for 60fps; move heavy tasks off main thread
- `progressive-loading` - Use skeleton screens / shimmer instead of long blocking spinners for >1s operations
- `input-latency` - Keep input latency under ~100ms for interactions
- `tap-feedback-speed` - Provide visual feedback within 100ms of interaction
- `debounce-throttle` - Use debounce/throttle for high-frequency events (scroll, resize, input)
- `offline-support` - Provide offline state messaging and basic fallback (PWA / mobile)
- `network-fallback` - Offer degraded modes for slow networks (lower-res images, fewer animations)

### 4. Style Selection (HIGH)

- `style-match` - Match style to product type (use `--design-system` for recommendations)
- `consistency` - Use same style across all pages
- `no-emoji-icons` - Use SVG icons (Heroicons, Lucide), not emojis
- `color-palette-from-product` - Choose palette from product/industry (search `--domain color`)
- `effects-match-style` - Shadows, blur, radius aligned with chosen style (glass / flat / clay etc.)
- `platform-adaptive` - Respect platform idioms: navigation, controls, typography, motion
- `state-clarity` - Make hover/pressed/disabled states visually distinct while staying on-style
- `elevation-consistent` - Use a consistent elevation/shadow scale for cards, sheets, modals; avoid random shadow values
- `dark-mode-pairing` - Design light/dark variants together to keep brand, contrast, and style consistent
- `icon-style-consistent` - Use one icon set/visual language (stroke width, corner radius) across the product
- `system-controls` - Prefer native/system controls over fully custom ones; only customize when branding requires it
- `blur-purpose` - Use blur to indicate background dismissal (modals, sheets), not as decoration
- `primary-action` - Each screen should have only one primary CTA; secondary actions visually subordinate

### 5. Layout & Responsive (HIGH)

- `viewport-meta` - width=device-width initial-scale=1 (never disable zoom)
- `mobile-first` - Design mobile-first, then scale up to tablet and desktop
- `breakpoint-consistency` - Use systematic breakpoints (e.g. 375 / 768 / 1024 / 1440)
- `readable-font-size` - Minimum 16px body text on mobile (avoids iOS auto-zoom)
- `line-length-control` - Mobile 35–60 chars per line; desktop 60–75 chars
- `horizontal-scroll` - No horizontal scroll on mobile; ensure content fits viewport width
- `spacing-scale` - Use 4pt/8dp incremental spacing system
- `touch-density` - Keep component spacing comfortable for touch: not cramped, not causing mis-taps
- `container-width` - Consistent max-width on desktop (max-w-6xl / 7xl)
- `z-index-management` - Define layered z-index scale (e.g. 0 / 10 / 20 / 40 / 100 / 1000)
- `fixed-element-offset` - Fixed navbar/bottom bar must reserve safe padding for underlying content
- `scroll-behavior` - Avoid nested scroll regions that interfere with the main scroll experience
- `viewport-units` - Prefer min-h-dvh over 100vh on mobile
- `orientation-support` - Keep layout readable and operable in landscape mode
- `content-priority` - Show core content first on mobile; fold or hide secondary content
- `visual-hierarchy` - Establish hierarchy via size, spacing, contrast — not color alone

### 6. Typography & Color (MEDIUM)

- `line-height` - Use 1.5-1.75 for body text
- `line-length` - Limit to 65-75 characters per line
- `font-pairing` - Match heading/body font personalities
- `font-scale` - Consistent type scale (e.g. 12 14 16 18 24 32)
- `contrast-readability` - Darker text on light backgrounds (e.g. slate-900 on white)
- `text-styles-system` - Use a consistent type system: display, headline, title, body, label roles
- `weight-hierarchy` - Use font-weight to reinforce hierarchy: Bold headings (600–700), Regular body (400), Medium labels (500)
- `color-semantic` - Define semantic color tokens (primary, secondary, error, surface, on-surface) not raw hex in components
- `color-dark-mode` - Dark mode uses desaturated / lighter tonal variants, not inverted colors; test contrast separately
- `color-accessible-pairs` - Foreground/background pairs must meet 4.5:1 (AA) or 7:1 (AAA); use tools to verify
- `color-not-decorative-only` - Functional color (error red, success green) must include icon/text; avoid color-only meaning
- `truncation-strategy` - Prefer wrapping over truncation; when truncating use ellipsis and provide full text via tooltip/expand
- `letter-spacing` - Respect default letter-spacing; avoid tight tracking on body text
- `number-tabular` - Use tabular/monospaced figures for data columns, prices, and timers to prevent layout shift
- `whitespace-balance` - Use whitespace intentionally to group related items and separate sections; avoid visual clutter

### 7. Animation (MEDIUM)

- `duration-timing` - Use 150–300ms for micro-interactions; complex transitions ≤400ms; avoid >500ms
- `transform-performance` - Use transform/opacity only; avoid animating width/height/top/left
- `loading-states` - Show skeleton or progress indicator when loading exceeds 300ms
- `excessive-motion` - Animate 1-2 key elements per view max
- `easing` - Use ease-out for entering, ease-in for exiting; avoid linear for UI transitions
- `motion-meaning` - Every animation must express a cause-effect relationship, not just be decorative
- `state-transition` - State changes (hover / active / expanded / collapsed / modal) should animate smoothly, not snap
- `continuity` - Page/screen transitions should maintain spatial continuity (shared element, directional slide)
- `parallax-subtle` - Use parallax sparingly; must respect reduced-motion and not cause disorientation
- `spring-physics` - Prefer spring/physics-based curves over linear or cubic-bezier for natural feel
- `exit-faster-than-enter` - Exit animations shorter than enter (~60–70% of enter duration) to feel responsive
- `stagger-sequence` - Stagger list/grid item entrance by 30–50ms per item; avoid all-at-once or too-slow reveals
- `shared-element-transition` - Use shared element / hero transitions for visual continuity between screens
- `interruptible` - Animations must be interruptible; user interaction cancels in-progress animation immediately
- `no-blocking-animation` - Never block user input during an animation; UI must stay interactive
- `fade-crossfade` - Use crossfade for content replacement within the same container
- `scale-feedback` - Subtle scale (0.95–1.05) on press for tappable cards/buttons; restore on release
- `gesture-feedback` - Drag, swipe, and pinch must provide real-time visual response tracking the finger
- `hierarchy-motion` - Use translate/scale direction to express hierarchy: enter from below = deeper, exit upward = back
- `motion-consistency` - Unify duration/easing tokens globally; all animations share the same rhythm and feel
- `opacity-threshold` - Fading elements should not linger below opacity 0.2; either fade fully or remain visible
- `modal-motion` - Modals/sheets should animate from their trigger source (scale+fade or slide-in) for spatial context
- `navigation-direction` - Forward navigation animates left/up; backward animates right/down — keep direction logically consistent
- `layout-shift-avoid` - Animations must not cause layout reflow or CLS; use transform for position changes

### 8. Forms & Feedback (MEDIUM)

- `input-labels` - Visible label per input (not placeholder-only)
- `error-placement` - Show error below the related field
- `submit-feedback` - Loading then success/error state on submit
- `required-indicators` - Mark required fields (e.g. asterisk)
- `empty-states` - Helpful message and action when no content
- `toast-dismiss` - Auto-dismiss toasts in 3-5s
- `confirmation-dialogs` - Confirm before destructive actions
- `input-helper-text` - Provide persistent helper text below complex inputs, not just placeholder
- `disabled-states` - Disabled elements use reduced opacity (0.38–0.5) + cursor change + semantic attribute
- `progressive-disclosure` - Reveal complex options progressively; don't overwhelm users upfront
- `inline-validation` - Validate on blur (not keystroke); show error only after user finishes input
- `input-type-keyboard` - Use semantic input types (email, tel, number) to trigger the correct mobile keyboard
- `password-toggle` - Provide show/hide toggle for password fields
- `autofill-support` - Use autocomplete attributes so the system can autofill
- `undo-support` - Allow undo for destructive or bulk actions (e.g. "Undo delete" toast)
- `success-feedback` - Confirm completed actions with brief visual feedback (checkmark, toast, color flash)
- `error-recovery` - Error messages must include a clear recovery path (retry, edit, help link)
- `multi-step-progress` - Multi-step flows show step indicator or progress bar; allow back navigation
- `form-autosave` - Long forms should auto-save drafts to prevent data loss on accidental dismissal
- `sheet-dismiss-confirm` - Confirm before dismissing a modal with unsaved changes
- `error-clarity` - Error messages must state cause + how to fix (not just "Invalid input")
- `field-grouping` - Group related fields logically (fieldset/legend or visual grouping)
- `read-only-distinction` - Read-only state should be visually and semantically different from disabled
- `focus-management` - After submit error, auto-focus the first invalid field
- `error-summary` - For multiple errors, show summary at top with anchor links to each field
- `touch-friendly-input` - Mobile input height ≥44px to meet touch target requirements
- `destructive-emphasis` - Destructive actions use semantic danger color (red) and are visually separated from primary actions
- `toast-accessibility` - Toasts must not steal focus; use aria-live="polite" for screen reader announcement
- `aria-live-errors` - Form errors use aria-live region or role="alert" to notify screen readers
- `contrast-feedback` - Error and success state colors must meet 4.5:1 contrast ratio
- `timeout-feedback` - Request timeout must show clear feedback with retry option

### 9. Navigation Patterns (HIGH)

- `bottom-nav-limit` - Bottom navigation max 5 items; use labels with icons
- `drawer-usage` - Use drawer/sidebar for secondary navigation, not primary actions
- `back-behavior` - Back navigation must be predictable and consistent; preserve scroll/state
- `deep-linking` - All key screens must be reachable via deep link / URL for sharing
- `nav-label-icon` - Navigation items must have both icon and text label; icon-only nav harms discoverability
- `nav-state-active` - Current location must be visually highlighted (color, weight, indicator) in navigation
- `nav-hierarchy` - Primary nav vs secondary nav must be clearly separated
- `modal-escape` - Modals and sheets must offer a clear close/dismiss affordance
- `search-accessible` - Search must be easily reachable; provide recent/suggested queries
- `breadcrumb-web` - Web: use breadcrumbs for 3+ level deep hierarchies to aid orientation
- `state-preservation` - Navigating back must restore previous scroll position, filter state, and input
- `gesture-nav-support` - Support system gesture navigation without conflict
- `tab-badge` - Use badges on nav items sparingly to indicate unread/pending; clear after user visits
- `overflow-menu` - When actions exceed available space, use overflow/more menu instead of cramming
- `adaptive-navigation` - Large screens (≥1024px) prefer sidebar; small screens use bottom/top nav
- `back-stack-integrity` - Never silently reset the navigation stack or unexpectedly jump to home
- `navigation-consistency` - Navigation placement must stay the same across all pages
- `avoid-mixed-patterns` - Don't mix Tab + Sidebar + Bottom Nav at the same hierarchy level
- `modal-vs-navigation` - Modals must not be used for primary navigation flows; they break the user's path
- `focus-on-route-change` - After page transition, move focus to main content region for screen reader users
- `persistent-nav` - Core navigation must remain reachable from deep pages
- `destructive-nav-separation` - Dangerous actions (delete account, logout) must be visually and spatially separated from normal nav items
- `empty-nav-state` - When a nav destination is unavailable, explain why instead of silently hiding it

### 10. Charts & Data (LOW)

- `chart-type` - Match chart type to data type (trend → line, comparison → bar, proportion → pie/donut)
- `color-guidance` - Use accessible color palettes; avoid red/green only pairs for colorblind users
- `data-table` - Provide table alternative for accessibility; charts alone are not screen-reader friendly
- `pattern-texture` - Supplement color with patterns, textures, or shapes so data is distinguishable without color
- `legend-visible` - Always show legend; position near the chart, not detached below a scroll fold
- `tooltip-on-interact` - Provide tooltips/data labels on hover or tap showing exact values
- `axis-labels` - Label axes with units and readable scale; avoid truncated or rotated labels on mobile
- `responsive-chart` - Charts must reflow or simplify on small screens
- `empty-data-state` - Show meaningful empty state when no data exists, not a blank chart
- `loading-chart` - Use skeleton or shimmer placeholder while chart data loads
- `animation-optional` - Chart entrance animations must respect prefers-reduced-motion
- `large-dataset` - For 1000+ data points, aggregate or sample; provide drill-down for detail
- `number-formatting` - Use locale-aware formatting for numbers, dates, currencies
- `touch-target-chart` - Interactive chart elements must have ≥44pt tap area
- `no-pie-overuse` - Avoid pie/donut for >5 categories; switch to bar chart for clarity
- `contrast-data` - Data lines/bars vs background ≥3:1; data text labels ≥4.5:1
- `legend-interactive` - Legends should be clickable to toggle series visibility
- `direct-labeling` - For small datasets, label values directly on the chart to reduce eye travel
- `tooltip-keyboard` - Tooltip content must be keyboard-reachable and not rely on hover alone
- `sortable-table` - Data tables must support sorting with aria-sort indicating current sort state
- `axis-readability` - Axis ticks must not be cramped; maintain readable spacing, auto-skip on small screens
- `data-density` - Limit information density per chart to avoid cognitive overload; split into multiple charts if needed
- `trend-emphasis` - Emphasize data trends over decoration; avoid heavy gradients/shadows that obscure the data
- `gridline-subtle` - Grid lines should be low-contrast so they don't compete with data
- `focusable-elements` - Interactive chart elements must be keyboard-navigable
- `screen-reader-summary` - Provide a text summary or aria-label describing the chart's key insight
- `error-state-chart` - Data load failure must show error message with retry action
- `export-option` - For data-heavy products, offer CSV/image export of chart data
- `drill-down-consistency` - Drill-down interactions must maintain a clear back-path and hierarchy breadcrumb
- `time-scale-clarity` - Time series charts must clearly label time granularity and allow switching

---

## Prerequisites

Check if Python is installed:

```powershell
python --version
```

If Python is not installed:

```powershell
winget install Python.Python.3.12
```

No `pip install` needed — the search engine uses only Python stdlib.

---

## How to Use This Skill

Use this skill when the user requests any of the following:

| Scenario                        | Trigger Examples                                              | Start From                         |
| ------------------------------- | ------------------------------------------------------------- | ---------------------------------- |
| **New project / page**          | "Build a landing page", "Build a dashboard"                   | Step 1 → Step 2 (design system)    |
| **New component**               | "Create a pricing card", "Add a modal"                        | Step 3 (domain search: style, ux)  |
| **Choose style / color / font** | "What style fits a fintech app?", "Recommend a color palette" | Step 2 (design system)             |
| **Review existing UI**          | "Review this page for UX issues", "Check accessibility"       | Quick Reference checklist above    |
| **Fix a UI bug**                | "Button hover is broken", "Layout shifts on load"             | Quick Reference → relevant section |
| **Improve / optimize**          | "Make this faster", "Improve mobile experience"               | Step 3 (domain search: ux, react)  |
| **Implement dark mode**         | "Add dark mode support"                                       | Step 3 (domain: style "dark mode") |
| **Add charts / data viz**       | "Add an analytics dashboard chart"                            | Step 3 (domain: chart)             |

Follow this workflow:

### Step 1: Analyze User Requirements

Extract key information from user request:

- **Product type**: SaaS, e-commerce, portfolio, healthcare, beauty, fintech, etc.
- **Target audience**: Consider age group, usage context
- **Style keywords**: playful, vibrant, minimal, dark mode, content-first, immersive, etc.
- **Stack**: Next.js + React + Tailwind CSS v4 + shadcn/ui (Cendaro stack)

### Step 2: Generate Design System (REQUIRED)

**Always start with `--design-system`** to get comprehensive recommendations with reasoning:

```powershell
python .agents/skills/ui-ux-pro-max/scripts/search.py "<product_type> <industry> <keywords>" --design-system [-p "Project Name"]
```

This command:

1. Searches domains in parallel (product, style, color, landing, typography)
2. Applies reasoning rules from `ui-reasoning.csv` to select best matches
3. Returns complete design system: pattern, style, colors, typography, effects
4. Includes anti-patterns to avoid

**Example:**

```powershell
python .agents/skills/ui-ux-pro-max/scripts/search.py "beauty spa wellness service" --design-system -p "Serenity Spa"
```

### Step 2b: Persist Design System (Master + Overrides Pattern)

To save the design system for **hierarchical retrieval across sessions**, add `--persist`:

```powershell
python .agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name"
```

This creates:

- `design-system/MASTER.md` — Global Source of Truth with all design rules
- `design-system/pages/` — Folder for page-specific overrides

**With page-specific override:**

```powershell
python .agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name" --page "dashboard"
```

This also creates:

- `design-system/pages/dashboard.md` — Page-specific deviations from Master

**How hierarchical retrieval works:**

1. When building a specific page (e.g., "Checkout"), first check `design-system/pages/checkout.md`
2. If the page file exists, its rules **override** the Master file
3. If not, use `design-system/MASTER.md` exclusively

### Step 3: Supplement with Detailed Searches (as needed)

After getting the design system, use domain searches to get additional details:

```powershell
python .agents/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain> [-n <max_results>]
```

**When to use detailed searches:**

| Need                      | Domain         | Example                                               |
| ------------------------- | -------------- | ----------------------------------------------------- |
| Product type patterns     | `product`      | `--domain product "entertainment social"`             |
| More style options        | `style`        | `--domain style "glassmorphism dark"`                 |
| Color palettes            | `color`        | `--domain color "entertainment vibrant"`              |
| Font pairings             | `typography`   | `--domain typography "playful modern"`                |
| Chart recommendations     | `chart`        | `--domain chart "real-time dashboard"`                |
| UX best practices         | `ux`           | `--domain ux "animation accessibility"`               |
| Alternative fonts         | `typography`   | `--domain typography "elegant luxury"`                |
| Individual Google Fonts   | `google-fonts` | `--domain google-fonts "sans serif popular variable"` |
| Landing structure         | `landing`      | `--domain landing "hero social-proof"`                |
| React/Next.js performance | `react`        | `--domain react "rerender memo list"`                 |
| App interface & a11y      | `web`          | `--domain web "accessibilityLabel touch safe-areas"`  |

---

## Cendaro Monorepo Integration

When implementing design system recommendations in this monorepo:

- **Import alias**: Use `~/` prefix (not `@/`) — e.g., `import { cn } from "~/lib/utils"`
- **shadcn/ui components**: From `@cendaro/ui` — check existing components before creating new ones
- **Tailwind version**: v4 with OKLCH color format — translate hex palettes to OKLCH tokens using `oklch()` function
- **CSS variables**: Define in `globals.css` using `@theme { }` declaration (not `@layer base`)
- **Default optimization domain**: Use `--domain react` for Next.js/React optimization tips
- **Design system persistence**: `--persist` creates `design-system/` at project root — add to `.gitignore` if generated files are transient
- **Pre-delivery**: Always run through Quick Reference §1–§3 (CRITICAL + HIGH) before delivering UI code

---

## Search Reference

### Available Domains

| Domain         | Use For                              | Example Keywords                                         |
| -------------- | ------------------------------------ | -------------------------------------------------------- |
| `product`      | Product type recommendations         | SaaS, e-commerce, portfolio, healthcare, beauty, service |
| `style`        | UI styles, colors, effects           | glassmorphism, minimalism, dark mode, brutalism          |
| `typography`   | Font pairings, Google Fonts          | elegant, playful, professional, modern                   |
| `color`        | Color palettes by product type       | saas, ecommerce, healthcare, beauty, fintech, service    |
| `landing`      | Page structure, CTA strategies       | hero, hero-centric, testimonial, pricing, social-proof   |
| `chart`        | Chart types, library recommendations | trend, comparison, timeline, funnel, pie                 |
| `ux`           | Best practices, anti-patterns        | animation, accessibility, z-index, loading               |
| `google-fonts` | Individual Google Fonts lookup       | sans serif, monospace, variable font, popular            |
| `react`        | React/Next.js performance            | waterfall, bundle, suspense, memo, rerender, cache       |
| `web`          | App interface guidelines             | accessibilityLabel, touch targets, safe areas            |
| `icons`        | Icon guidance and libraries          | lucide, heroicons, symbol, svg icon                      |

### Available Stacks

| Stack          | Focus                         |
| -------------- | ----------------------------- |
| `react-native` | Components, Navigation, Lists |

> **Note**: For Next.js/React best practices, use `--domain react` instead of `--stack`.

---

## Output Formats

The `--design-system` flag supports two output formats:

```powershell
# ASCII box (default) - best for terminal display
python .agents/skills/ui-ux-pro-max/scripts/search.py "fintech crypto" --design-system

# Markdown - best for documentation
python .agents/skills/ui-ux-pro-max/scripts/search.py "fintech crypto" --design-system -f markdown
```

---

## Example Workflow

**User request:** "Build a landing page for an AI search engine."

### Step 1: Analyze Requirements

- Product type: Tool (AI search engine)
- Target audience: Users looking for fast, intelligent search
- Style keywords: modern, minimal, content-first, dark mode
- Stack: Next.js + React + Tailwind CSS v4 + shadcn/ui

### Step 2: Generate Design System (REQUIRED)

```powershell
python .agents/skills/ui-ux-pro-max/scripts/search.py "AI search tool modern minimal" --design-system -p "AI Search"
```

**Output:** Complete design system with pattern, style, colors, typography, effects, and anti-patterns.

### Step 3: Supplement with Detailed Searches (as needed)

```powershell
# Get style options for a modern tool product
python .agents/skills/ui-ux-pro-max/scripts/search.py "minimalism dark mode" --domain style

# Get UX best practices for search interaction and loading
python .agents/skills/ui-ux-pro-max/scripts/search.py "search loading animation" --domain ux

# Get React/Next.js performance tips
python .agents/skills/ui-ux-pro-max/scripts/search.py "waterfall bundle suspense" --domain react
```

**Then:** Synthesize design system + detailed searches and implement the design.

---

## Tips for Better Results

### Query Strategy

- Use **multi-dimensional keywords** — combine product + industry + tone: `"entertainment social vibrant content-dense"` not just `"app"`
- Try different keywords for the same need: `"playful neon"` → `"vibrant dark"` → `"content-first minimal"`
- Use `--design-system` first for full recommendations, then `--domain` to deep-dive any dimension
- Use `--domain react` for Next.js/React-specific implementation guidance

### Common Sticking Points

| Problem                        | What to Do                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| Can't decide on style/color    | Re-run `--design-system` with different keywords                                    |
| Dark mode contrast issues      | Quick Reference §6: `color-dark-mode` + `color-accessible-pairs`                    |
| Animations feel unnatural      | Quick Reference §7: `spring-physics` + `easing` + `exit-faster-than-enter`          |
| Form UX is poor                | Quick Reference §8: `inline-validation` + `error-clarity` + `focus-management`      |
| Navigation feels confusing     | Quick Reference §9: `nav-hierarchy` + `bottom-nav-limit` + `back-behavior`          |
| Layout breaks on small screens | Quick Reference §5: `mobile-first` + `breakpoint-consistency`                       |
| Performance / jank             | Quick Reference §3: `virtualize-lists` + `main-thread-budget` + `debounce-throttle` |

---

## Common Rules for Professional UI

> Scope notice: The Quick Reference rules above are universal (web + mobile). The rules below include mobile-specific items (tagged with platform names) — apply web equivalents where applicable.

These are frequently overlooked issues that make UI look unprofessional:

### Icons & Visual Elements

| Rule                          | Standard                                                                     | Avoid                                                                   | Why It Matters                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **No Emoji as Icons**         | Use vector-based icons (Lucide, Heroicons).                                  | Using emojis (🎨 🚀 ⚙️) for navigation or controls.                     | Emojis are font-dependent, inconsistent across platforms, and cannot be controlled via design tokens. |
| **Vector-Only Assets**        | Use SVG or vector icons that scale cleanly and support theming.              | Raster PNG icons that blur or pixelate.                                 | Ensures scalability, crisp rendering, and dark/light mode adaptability.                               |
| **Stable Interaction States** | Use color, opacity, or elevation transitions for press states.               | Layout-shifting transforms that move surrounding content.               | Prevents unstable interactions and preserves smooth motion.                                           |
| **Correct Brand Logos**       | Use official brand assets and follow their usage guidelines.                 | Guessing logo paths, recoloring unofficially, or modifying proportions. | Prevents brand misuse and ensures compliance.                                                         |
| **Consistent Icon Sizing**    | Define icon sizes as design tokens (e.g., icon-sm, icon-md = 24pt, icon-lg). | Mixing arbitrary values like 20pt / 24pt / 28pt randomly.               | Maintains rhythm and visual hierarchy.                                                                |
| **Stroke Consistency**        | Use a consistent stroke width within the same visual layer.                  | Mixing thick and thin stroke styles arbitrarily.                        | Inconsistent strokes reduce perceived polish.                                                         |
| **Filled vs Outline**         | Use one icon style per hierarchy level.                                      | Mixing filled and outline icons at the same level.                      | Maintains semantic clarity and stylistic coherence.                                                   |
| **Touch Target Minimum**      | Minimum 44×44pt interactive area.                                            | Small icons without expanded tap area.                                  | Meets accessibility and usability standards.                                                          |
| **Icon Alignment**            | Align icons to text baseline and maintain consistent padding.                | Misaligned icons or inconsistent spacing.                               | Prevents subtle visual imbalance.                                                                     |
| **Icon Contrast**             | Follow WCAG: 4.5:1 for small elements, 3:1 for larger UI glyphs.             | Low-contrast icons that blend into background.                          | Ensures accessibility in both light and dark modes.                                                   |

### Interaction

| Rule                     | Do                                                                        | Don't                                                 |
| ------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Tap feedback**         | Provide clear pressed feedback (ripple/opacity/elevation) within 80-150ms | No visual response on interaction                     |
| **Animation timing**     | Keep micro-interactions around 150-300ms with easing                      | Instant transitions or slow animations (>500ms)       |
| **Accessibility focus**  | Ensure focus order matches visual order and labels are descriptive        | Unlabeled controls or confusing focus traversal       |
| **Disabled state**       | Use disabled semantics, reduced emphasis, and no action                   | Controls that look interactive but do nothing         |
| **Touch target minimum** | Keep interactive areas >=44x44pt                                          | Tiny tap targets or icon-only areas without padding   |
| **Gesture conflict**     | Keep one primary gesture per region                                       | Overlapping gestures causing accidental actions       |
| **Semantic controls**    | Prefer native interactive elements with proper accessibility roles        | Generic containers used as controls without semantics |

### Light/Dark Mode Contrast

| Rule                            | Do                                                                 | Don't                                            |
| ------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| **Surface readability (light)** | Keep cards/surfaces clearly separated from background              | Overly transparent surfaces that blur hierarchy  |
| **Text contrast (light)**       | Maintain body text contrast >=4.5:1 against light surfaces         | Low-contrast gray body text                      |
| **Text contrast (dark)**        | Maintain primary text >=4.5:1 and secondary >=3:1 on dark surfaces | Dark mode text that blends into background       |
| **Border visibility**           | Ensure separators are visible in both themes                       | Theme-specific borders disappearing in one mode  |
| **State contrast parity**       | Keep interaction states equally distinguishable in light and dark  | Defining states for one theme only               |
| **Token-driven theming**        | Use semantic color tokens mapped per theme                         | Hardcoded per-screen hex values                  |
| **Scrim legibility**            | Use modal scrim strong enough to isolate foreground (40-60% black) | Weak scrim leaving background visually competing |

### Layout & Spacing

| Rule                             | Do                                                           | Don't                                             |
| -------------------------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| **Consistent content width**     | Keep predictable content width per device class              | Mixing arbitrary widths between screens           |
| **8dp spacing rhythm**           | Use a consistent 4/8dp spacing system                        | Random spacing increments with no rhythm          |
| **Readable text measure**        | Keep long-form text readable (avoid edge-to-edge paragraphs) | Full-width long text that hurts readability       |
| **Section spacing**              | Define clear vertical rhythm tiers (e.g., 16/24/32/48)       | Similar UI levels with inconsistent spacing       |
| **Adaptive gutters**             | Increase horizontal insets on larger widths                  | Same narrow gutter on all device sizes            |
| **Scroll and fixed coexistence** | Add content insets so lists are not hidden behind fixed bars | Scroll content obscured by sticky headers/footers |

---

## Pre-Delivery Checklist

Before delivering UI code, verify these items:

> Scope notice: This checklist applies to both web and mobile UI. Mobile-specific items are labeled.

### Visual Quality

- [ ] No emojis as structural icons (use SVG: Lucide/Heroicons)
- [ ] cursor-pointer on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Consistent elevation/shadow scale
- [ ] Icon style matches chosen design system
- [ ] Dark mode variant designed (not just inverted)

### Interaction Quality

- [ ] All interactive elements have visible hover and focus states
- [ ] Disabled states are visually distinct (opacity 0.38-0.5)
- [ ] Loading states for all async operations (skeleton/shimmer)
- [ ] Confirm before destructive actions
- [ ] Form validation on blur, not keystroke

### Light/Dark Mode

- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Dark mode: text contrast 4.5:1 minimum (tested separately)
- [ ] Borders and dividers visible in both themes
- [ ] Token-driven theming (no hardcoded hex)

### Layout

- [ ] Responsive: 375px, 768px, 1024px, 1440px tested
- [ ] No horizontal scroll on any breakpoint
- [ ] Content doesn't get hidden behind fixed elements
- [ ] Consistent max-width container on desktop

### Accessibility

- [ ] Focus states visible for keyboard navigation
- [ ] prefers-reduced-motion respected
- [ ] aria-labels on icon-only buttons
- [ ] Heading hierarchy (h1 → h2 → h3, no skips)
- [ ] Color is never the only indicator of state
- [ ] Touch targets ≥44px

---

## UX Validation Pass

Before final delivery, run a UX validation search:

```powershell
python .agents/skills/ui-ux-pro-max/scripts/search.py "animation accessibility z-index loading" --domain ux
```

Then review Quick Reference **§1–§3** (CRITICAL + HIGH) as a final check.
