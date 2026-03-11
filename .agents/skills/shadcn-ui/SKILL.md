---
name: shadcn-ui
description: Expert guidance for integrating and building applications with shadcn/ui components, including project-aware context detection, full CLI reference, component discovery, OKLCH theming (Tailwind v3/v4), registry authoring, and best practices.
allowed-tools:
  - "shadcn*:*"
  - "mcp_shadcn*"
  - "Read"
  - "Write"
  - "Bash"
  - "web_fetch"
---

# shadcn/ui Component Integration

You are a frontend engineer specialized in building applications with shadcn/ui—a collection of beautifully designed, accessible, and customizable components built with Radix UI or Base UI and Tailwind CSS. You help developers discover, integrate, and customize components following best practices.

## Core Principles

shadcn/ui is **not a component library**—it's a collection of reusable components that you copy into your project. This gives you:

- **Full ownership**: Components live in your codebase, not node_modules
- **Complete customization**: Modify styling, behavior, and structure freely, including choosing between Radix UI or Base UI primitives
- **No version lock-in**: Update components selectively at your own pace
- **Zero runtime overhead**: No library bundle, just the code you need

## Project Context Detection

Before generating code or installing components, **always detect the project context** to ensure correct output:

```bash
npx shadcn@latest info --json
```

This returns the full project configuration:

- **Framework**: Next.js, Vite, Laravel, Remix, etc.
- **Tailwind version**: v3 or v4 (affects theming approach)
- **Base library**: Radix UI or Base UI
- **Icon library**: lucide-react, etc.
- **Installed components**: List of already-added components
- **Aliases**: Resolved import paths (`@/components`, `@/lib`, etc.)
- **Style/Preset**: current visual style (e.g., new-york, Vega, Nova)

**Why this matters**: The output of `shadcn info --json` determines which APIs, import paths, and base-specific patterns to use when generating code. Always run this before suggesting component code.

### Cendaro Monorepo Context

In this monorepo, `components.json` lives at `packages/ui/components.json` with:

- **Style**: `new-york`
- **RSC**: `true`
- **Base color**: `zinc`
- **CSS variables**: `true`
- **Aliases**: `utils → @cendaro/ui`, `components → src/`, `ui → src/`

## Component Discovery and Installation

### 1. Browse Available Components

Use the shadcn MCP tools to explore the component catalog and Registry Directory:

- **List all components**: Use `list_components` to see the complete catalog
- **Get component metadata**: Use `get_component_metadata` to understand props, dependencies, and usage
- **View component demos**: Use `get_component_demo` to see implementation examples

### 2. Component Installation

There are two approaches to adding components:

**A. Direct Installation (Recommended)**

```bash
npx shadcn@latest add [component-name]
```

This command:

- Downloads the component source code (adapting to your config: Radix vs Base UI)
- Installs required dependencies
- Places files in `components/ui/`
- Updates your `components.json` config

**B. Manual Integration**

1. Use `get_component` to retrieve the source code
2. Create the file in `components/ui/[component-name].tsx`
3. Install peer dependencies manually
4. Adjust imports if needed

### Full CLI Reference

| Command                    | Purpose                                            | Example                                    |
| -------------------------- | -------------------------------------------------- | ------------------------------------------ |
| `npx shadcn@latest init`   | Initialize project config                          | `npx shadcn@latest init`                   |
| `npx shadcn@latest create` | Create new project with custom style/framework     | `npx shadcn@latest create`                 |
| `npx shadcn@latest add`    | Add component(s) to project                        | `npx shadcn@latest add button card dialog` |
| `npx shadcn@latest search` | Search available components                        | `npx shadcn@latest search table`           |
| `npx shadcn@latest view`   | View component source and metadata                 | `npx shadcn@latest view button`            |
| `npx shadcn@latest docs`   | Open component documentation                       | `npx shadcn@latest docs dialog`            |
| `npx shadcn@latest diff`   | Show changes between local and upstream components | `npx shadcn@latest diff button`            |
| `npx shadcn@latest info`   | Show project config and installed components       | `npx shadcn@latest info --json`            |
| `npx shadcn@latest build`  | Build a custom component registry                  | `npx shadcn@latest build`                  |

**Useful flags:**

- `--dry-run`: Preview changes without applying them
- `--overwrite`: Overwrite existing components
- `--path <dir>`: Specify custom output directory
- `--preset <name>`: Use a visual preset (Vega, Nova, Maia, Lyra, Mira)
- `--json`: Output in JSON format (for `info`)

### 3. Registry and Custom Registries

If working with a custom registry (defined in `components.json`) or exploring the Registry Directory:

- Use `get_project_registries` to list available registries
- Use `list_items_in_registries` to see registry-specific components
- Use `view_items_in_registries` for detailed component information
- Use `search_items_in_registries` to find specific components

## Project Setup

### Initial Configuration

For **new projects**, use the `create` command to customize everything (style, fonts, component library):

```bash
npx shadcn@latest create
```

For **existing projects**, initialize configuration:

```bash
npx shadcn@latest init
```

This creates `components.json` with your configuration:

- **style**: default, new-york (classic) OR choose new visual styles like Vega, Nova, Maia, Lyra, Mira
- **baseColor**: slate, gray, zinc, neutral, stone
- **cssVariables**: true/false for CSS variable usage
- **tailwind config**: paths to Tailwind files
- **aliases**: import path shortcuts
- **rsc**: Use React Server Components (yes/no)
- **rtl**: Enable RTL support (optional)

### Required Dependencies

shadcn/ui components require:

- **React** (18+)
- **Tailwind CSS** (3.0+ or 4.0+)
- **Primitives**: Radix UI OR Base UI (depending on your choice)
- **class-variance-authority** (for variant styling)
- **clsx** and **tailwind-merge** (for class composition)

## Component Architecture

### File Structure

```
src/
├── components/
│   ├── ui/              # shadcn components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── dialog.tsx
│   └── [custom]/        # your composed components
│       └── user-card.tsx
├── lib/
│   └── utils.ts         # cn() utility
└── app/
    └── page.tsx
```

### The `cn()` Utility

All shadcn components use the `cn()` helper for class merging:

```typescript
import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

This allows you to:

- Override default styles without conflicts
- Conditionally apply classes
- Merge Tailwind classes intelligently

## Customization Best Practices

### 1. Theme Customization

Edit your Tailwind config and CSS variables in `app/globals.css`:

**Tailwind v3 (HSL format)**:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    /* ... more variables */
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... dark mode overrides */
  }
}
```

**Tailwind v4 (OKLCH format — preferred)**:

```css
@theme {
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0.017 261.325);
  --color-primary: oklch(0.546 0.245 262.881);
  --color-primary-foreground: oklch(0.981 0.004 264.449);
  --color-secondary: oklch(0.97 0.001 264.542);
  --color-secondary-foreground: oklch(0.205 0.017 265.755);
  --color-muted: oklch(0.97 0.001 264.542);
  --color-muted-foreground: oklch(0.556 0.016 264.449);
  --color-accent: oklch(0.97 0.001 264.542);
  --color-accent-foreground: oklch(0.205 0.017 265.755);
  --color-destructive: oklch(0.577 0.245 27.325);
  --color-border: oklch(0.92 0.004 264.542);
  --color-ring: oklch(0.546 0.245 262.881);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
}
```

**Why OKLCH?** OKLCH is a perceptually uniform color space — adjusting lightness/chroma produces visually consistent results, unlike HSL where perceived brightness varies wildly across hues. Tailwind v4 uses `@theme` declaration instead of `@layer base`, and colors use `oklch()` natively.

### 2. Component Variants

Use `class-variance-authority` (cva) for variant logic:

```typescript
import { cva } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        outline: "border-input border",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
```

### 3. Extending Components

Create wrapper components in `components/` (not `components/ui/`):

```typescript
// components/custom-button.tsx
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export function LoadingButton({
  loading,
  children,
  ...props
}: ButtonProps & { loading?: boolean }) {
  return (
    <Button disabled={loading} {...props}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  )
}
```

## Blocks and Complex Components

shadcn/ui provides complete UI blocks (authentication forms, dashboards, etc.):

1. **List available blocks**: Use `list_blocks` with optional category filter
2. **Get block source**: Use `get_block` with the block name
3. **Install blocks**: Many blocks include multiple component files

Blocks are organized by category:

- **calendar**: Calendar interfaces
- **dashboard**: Dashboard layouts
- **login**: Authentication flows
- **sidebar**: Navigation sidebars
- **products**: E-commerce components

## Accessibility

All shadcn/ui components are built on Radix UI primitives, ensuring:

- **Keyboard navigation**: Full keyboard support out of the box
- **Screen reader support**: Proper ARIA attributes
- **Focus management**: Logical focus flow
- **Disabled states**: Proper disabled and aria-disabled handling

When customizing, maintain accessibility:

- Keep ARIA attributes
- Preserve keyboard handlers
- Test with screen readers
- Maintain focus indicators

## Common Patterns

### Form Building

```typescript
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Use with react-hook-form for validation
import { useForm } from "react-hook-form";
```

### Dialog/Modal Patterns

```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
```

### Data Display

```typescript
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
```

## Registry Authoring

Create and publish custom component registries to share components across projects or with the community.

### Registry Structure

Create a `registry.json` at your project root:

```json
{
  "$schema": "https://ui.shadcn.com/schema/registry.json",
  "name": "cendaro",
  "homepage": "https://cendaro.com",
  "items": [
    {
      "name": "status-badge",
      "type": "registry:ui",
      "title": "Status Badge",
      "description": "A badge component for displaying status indicators.",
      "dependencies": ["class-variance-authority"],
      "files": [
        {
          "path": "src/components/ui/status-badge.tsx",
          "type": "registry:ui"
        }
      ]
    }
  ]
}
```

### Item Types

| Type                 | Description                               |
| -------------------- | ----------------------------------------- |
| `registry:ui`        | UI component (placed in `components/ui/`) |
| `registry:component` | Composed component                        |
| `registry:hook`      | Custom React hook                         |
| `registry:lib`       | Utility library                           |
| `registry:block`     | Full page/section block                   |
| `registry:theme`     | Theme configuration                       |

### Building and Publishing

```bash
# Build registry output
npx shadcn@latest build

# Output goes to ./public/r/ by default
# Host the output directory on any static hosting
```

### Using Custom Registries

Consumers add your registry to their `components.json`:

```json
{
  "registries": {
    "cendaro": {
      "url": "https://cendaro.com/r"
    }
  }
}
```

Then install components from it:

```bash
npx shadcn@latest add cendaro/status-badge
```

## Troubleshooting

### Import Errors

- Check `components.json` for correct alias configuration
- Verify `tsconfig.json` includes the `@` path alias:
  ```json
  {
    "compilerOptions": {
      "paths": {
        "@/*": ["./src/*"]
      }
    }
  }
  ```

### Style Conflicts

- Ensure Tailwind CSS is properly configured
- Check that `globals.css` is imported in your root layout
- Verify CSS variable names match between components and theme

### Missing Dependencies

- Run component installation via CLI to auto-install deps
- Manually check `package.json` for required Radix UI packages
- Use `get_component_metadata` to see dependency lists

### Version Compatibility

- shadcn/ui requires React 18+ and Next.js 13+ (if using Next.js)
- Tailwind v3 uses HSL color variables; Tailwind v4 uses OKLCH and `@theme`
- Some components require specific Radix UI or Base UI versions
- Run `npx shadcn@latest diff` to see upstream changes before updating
- Check documentation for breaking changes between versions

## Validation and Quality

Before committing components:

1. **Type check**: Run `tsc --noEmit` to verify TypeScript
2. **Lint**: Run your linter to catch style issues
3. **Test accessibility**: Use tools like axe DevTools
4. **Visual QA**: Test in light and dark modes
5. **Responsive check**: Verify behavior at different breakpoints

## Resources

Refer to the following resource files for detailed guidance:

- `resources/setup-guide.md` - Step-by-step project initialization
- `resources/component-catalog.md` - Complete component reference
- `resources/customization-guide.md` - Theming and variant patterns
- `resources/migration-guide.md` - Upgrading from other UI libraries

## Examples

See the `examples/` directory for:

- Complete component implementations
- Form patterns with validation
- Dashboard layouts
- Authentication flows
- Data table implementations
