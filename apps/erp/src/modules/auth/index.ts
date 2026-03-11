/**
 * Auth & RBAC Module
 *
 * @see docs/architecture/module_api_blueprint_v1.md §3.1
 *
 * Screens: login, user management, role/permission assignment
 * Endpoints: auth.login, users.{list,create,update,assignRole}, permissions.matrix
 */
export const MODULE_ID = "auth" as const;
