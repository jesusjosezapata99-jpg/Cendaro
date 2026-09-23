# Cendaro ERP — Design System & Visual Grammar

> Generated and enforced via **`impeccable`** and **`ui-ux-pro-max`**.
> Single source of truth for UI/UX across all AI coding assistants (Claude Code, Antigravity, Codex).

---

## 1. Brand Identity & Aesthetic Principles

- **Style Archetype**: **Monochrome Precision SaaS / High-Contrast Enterprise Grid**
- **Core Philosophy**: Color only carries meaning (status, focus, alerts), never pure decoration.
- **Corner Radius**: `--radius: 0rem` (**Radius 0 everywhere** — strict sharp edges; rounded only for badge pills and circular user avatars).
- **Aesthetic Benchmark**: Linear meets Bloomberg Terminal — high information density, virtualized tables, zero UI clutter.

---

## 2. Color Palette & Token System

All colors are calibrated against WCAG AA/AAA contrast ratios (`scripts/checks/contrast.mjs`):

| Token                | Light Mode Value   | Purpose                                               |
| :------------------- | :----------------- | :---------------------------------------------------- |
| `--background`       | `hsl(0 0% 100%)`   | Main surface canvas                                   |
| `--foreground`       | `hsl(0 0% 7%)`     | Primary text (ultra-high contrast)                    |
| `--card`             | `hsl(45 18% 96%)`  | Elevated containers and panels                        |
| `--muted-foreground` | `hsl(0 0% 38%)`    | Secondary / metadata text (calibrated 6.2:1 contrast) |
| `--border`           | `hsl(45 5% 85%)`   | Fine grid separators (`1px solid`)                    |
| `--destructive`      | `hsl(0 84.2% 48%)` | Error states and destructive operations               |

### Status Tones (Semantic Meaning Only)

- **Neutral**: FG `#616161` / BG `#f2f1ef` (Drafts, Inactive)
- **Success**: FG `#007a3d` / BG `#ddf1e4` (Paid, Delivered, Active)
- **Warning**: FG `#8a6500` / BG `rgb(255 208 43 / 0.1)` (Pending, Low Stock)
- **Info**: FG `#1a56c4` / BG `#ddebff` (In Transit, Processing)
- **Destructive**: FG `#c21f21` / BG `rgb(255 54 56 / 0.1)` (Cancelled, Failed, Void)

---

## 3. Typography & Numerical Formatting

- **Primary Font Family**: Clean sans-serif system stack (`Inter`, `system-ui`, `-apple-system`).
- **Tabular Figures**: Always use `font-mono` / `tabular-nums` for currency, quantities, SKUs, and invoices.
- **Hierarchy**:
  - Page Title: `text-2xl font-semibold tracking-tight`
  - Section Header: `text-lg font-medium`
  - Table Header: `text-xs uppercase font-medium tracking-wider text-muted-foreground`
  - Body / Cell Data: `text-sm font-normal text-foreground`
  - Captions / Meta: `text-xs text-muted-foreground`

---

## 4. Impeccable Anti-Patterns (Strict Rules for Claude Code & Antigravity)

1. ❌ **NO Generic Purple Gradients / AI Slop**: Never apply decorative purple/pink gradients on dark cards.
2. ❌ **NO Arbitrary Rounded Corners**: Never apply `rounded-md`, `rounded-lg`, or `rounded-xl` to buttons, cards, or inputs. Keep `--radius: 0rem`.
3. ❌ **NO Low Contrast Text**: Never use light gray text (`#999999` or below) on white backgrounds. Use calibrated `--muted-foreground`.
4. ❌ **NO Double Padding**: Always separate container layout padding from inner component padding.
5. ❌ **NO Layout Shifts (CLS)**: Always reserve explicit dimensions for badges, avatars, and async table cells.
