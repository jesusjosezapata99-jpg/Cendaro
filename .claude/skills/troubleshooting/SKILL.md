---
name: troubleshooting
description: Known environment problems in the Cendaro repo on Windows and their fixes. Use when agent-browser hangs or reports stale errors, Prettier flags every file, tsc breaks on .next/dev/types, `pnpm exec` cannot find a tool, ESLint fails in lint-staged, or RTK output looks incomplete.
---

# Troubleshooting the development environment

## agent-browser

- Never pipe the first command of a session (`open`): the session hangs.
- `errors --clear` does not empty the error buffer. For a clean error list, start a new `--session`.
- After `wait --url`, confirm with `get url`: a read error `os error 10060` can appear even when navigation succeeded.
- Use `snapshot -i` (interactive elements only); the RTK hook adds `-i` automatically.

## Prettier flags every file

`core.autocrlf=true` checked the working tree out with CRLF. `.gitattributes` forces `eol=lf` for new checkouts; until a file is checked out again, run `pnpm exec prettier --check --end-of-line auto <files>`.

## `tsc --noEmit` fails inside apps/erp/.next/dev/types

The dev server wrote those generated route types while another process read them. The folder is gitignored and regenerates, so delete it. If it keeps happening, use `pnpm build` as the verification gate instead of raw `tsc`.

## `pnpm exec <tool>` not found, or bare eslint/prettier fail

`node_modules/.bin` is not on PATH, and `pnpm exec` only finds tools in the root devDependencies. Add the tool to the root `package.json`.

## ESLint fails in lint-staged

A root `eslint.config.ts` must exist and export `defineConfig(baseConfig)`.

## TypeScript and ESLint disagree about `?.`

When TypeScript's types say a value can be nullish but ESLint reports the optional chain as unnecessary, keep `?.` and add an `eslint-disable-next-line` comment with the rule name.

## RTK output looks incomplete

RTK condenses shell output. When the output ends with `[full output: rtk recall <id>]`, run that command. To run a command with no filtering, use `rtk proxy <cmd>` and read its exit code. `pnpm lint` used to look empty because RTK rewrote it to plain ESLint (`rtk lint`); since 2026-09-28 the hook routes it through `rtk err pnpm lint` instead.
