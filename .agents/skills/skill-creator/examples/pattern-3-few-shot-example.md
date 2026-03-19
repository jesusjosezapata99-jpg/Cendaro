# Example — Few-Shot Transformer Skill (Pattern 3)

This is a complete working example of a Pattern 3 skill.
Use it as a reference when building transformer-type skills.

---

## Directory structure

```
json-to-typescript/
├── SKILL.md
└── examples/
    ├── input.json       ← the "before" state
    └── output.ts        ← the "after" state
```

---

## SKILL.md

```markdown
---
name: json-to-typescript
description: >
  Converts JSON data or API responses into strongly-typed TypeScript interfaces.
  Use when the user provides a JSON object and wants TypeScript types, or says
  "convert this JSON to TypeScript", "generate types for this response", or
  "make a TypeScript interface for this". Follows the style in examples/output.ts exactly.
---

# JSON to TypeScript Converter

## Goal

Produce TypeScript interfaces that exactly represent the structure of the input JSON,
following the style established in `examples/output.ts`.

## Instructions

1. Read `examples/input.json` and `examples/output.ts` to understand the expected style
2. Apply the same transformation to the user's JSON input

## Style rules (from the example)

- Interface names: PascalCase
- Optional fields (null or missing): `field?: Type`
- Arrays: `field: Type[]`
- Nested objects: separate named interface
- No `any` types — infer the most specific type

## Constraints

- Never add fields not present in the input
- Never use `any` or `object` types
- Always export all interfaces
```

---

## examples/input.json

```json
{
  "user_id": 12345,
  "username": "nutt_dev",
  "is_active": true,
  "preferences": {
    "theme": "dark",
    "notifications": ["email", "push"]
  },
  "last_login": "2024-03-15T10:30:00Z",
  "meta_tags": null
}
```

---

## examples/output.ts

```typescript
export interface Preferences {
  theme: string;
  notifications: string[];
}

export interface User {
  user_id: number;
  username: string;
  is_active: boolean;
  preferences: Preferences;
  last_login: string;
  meta_tags?: string[];
}
```

---

## Why this pattern works

Showing Opus 4.6 one precise input→output pair is more reliable than writing 15 rules in English.
The model pattern-matches the transformation and applies it consistently. For style-heavy tasks
(naming conventions, type choices, structure decisions), few-shot always beats verbose instructions.
