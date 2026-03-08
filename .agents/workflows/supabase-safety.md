---
description: Supabase MCP safety rules — which project to target for database operations
---

# Supabase Project Safety Rules

## CRITICAL: Project Identification

This monorepo (**Cendaro** / project folder `TEST`) uses the following Supabase project:

| Property | Value |
|----------|-------|
| **Project Name** | Cendaro |
| **Project ID** | `ljwoptpaxazqmnhdczsb` |
| **Region** | eu-west-3 |
| **API URL** | `https://ljwoptpaxazqmnhdczsb.supabase.co` |

## FORBIDDEN: Never Touch These Projects

The following Supabase projects belong to **other production applications** and must **NEVER** be modified:

| Project Name | Project ID | Reason |
|-------------|-----------|--------|
| **Svartx** | `xlgyogcaflsmmwpcuiwk` | Production e-commerce — SvartxLab |

## Rules for MCP Database Operations

// turbo-all

1. **ALWAYS** use project ID `ljwoptpaxazqmnhdczsb` for any Supabase MCP tool call
2. **NEVER** use project ID `xlgyogcaflsmmwpcuiwk` for any operation
3. Before running `apply_migration`, `execute_sql`, or any write operation, verify the `project_id` parameter matches `ljwoptpaxazqmnhdczsb`
4. If unsure which project to use, **ask the user** before proceeding
5. When listing projects, always confirm with the user which project to target

## Verification Steps

Before any database modification:

```
1. Confirm project_id = ljwoptpaxazqmnhdczsb
2. Confirm project name = Cendaro
3. Proceed with the operation
```
