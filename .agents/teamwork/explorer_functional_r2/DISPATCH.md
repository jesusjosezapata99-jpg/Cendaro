# DISPATCH — explorer_functional_r2

## Assignment

Execute R2: Functional, Interconnection & Employee Modules Ergonomics Audit of Cendaro ERP.

### Working Directory

`c:\Users\jzs99\Desktop\TEST\.agents\teamwork\explorer_functional_r2\`

### Scope of Investigation

1. **Inventory of Employee Modules**:
   - Audit all employee-destined modules in `apps/erp/src/app` and related components:
     - Point of Sale (POS), Sales / Orders, Purchases, Inventory / Warehouse, Customers / CRM, Employees / HR, Financial / Billing / Cash register, Settings & Audit logs.
2. **Current Operational Status**:
   - For every module, assess current completeness: Fully Functional, Partially Implemented, Stub / Mock / Placeholder, Broken / Dead Route.
3. **Module Interconnection & Data Flow**:
   - How modules communicate: tRPC procedure calls from UI, mutations, cache invalidation, cross-module dependencies (e.g., POS reducing inventory, orders generating invoices, employee attendance/cash shifts).
   - Identify broken links, missing hooks, dangling UI actions, or disconnected workflows.
4. **Ergonomics & Visual Navigation**:
   - Speed of access for warehouse and retail cashiers/employees.
   - Compliance with Cendaro Design System:
     - Radius = 0 (no `rounded-*`, only `rounded-full` on StatusPill/Badge/avatars)
     - Font weight limit (`font-medium` max, no `font-semibold` / `font-bold`)
     - Colors from `theme.css` tokens (no raw hex/rgb)
     - Icons from `@cendaro/ui/icons`
     - Status chips through `getStatus` and `StatusPill`.
   - Keyboard shortcuts, scanner support, cashier ergonomic speed.
5. **Gaps to Reach 100% Operability**:
   - Exhaustive task breakdown detailing exactly what is missing in UI, backend logic, validation, and integration for each module to reach 100% production readiness.
6. **Deliverable**:
   - Write comprehensive report to `report.md` in your working directory and deliver a complete `handoff.md`.
   - DO NOT modify any code.
