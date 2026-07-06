/** Route → permission required (aligned with AppSidebar nav). */
const ROUTE_PERMISSIONS: Array<{ prefix: string; permission: string }> = [
  { prefix: "/dashboard", permission: "view_dashboard" },
  { prefix: "/pos", permission: "manage_pos" },
  { prefix: "/products", permission: "manage_products" },
  { prefix: "/staff", permission: "manage_staff" },
  { prefix: "/table-assignments", permission: "manage_staff" },
  { prefix: "/discounts", permission: "view_discounts" },
  { prefix: "/reports", permission: "view_reports" },
  { prefix: "/audit-logs", permission: "view_audit_logs" },
  { prefix: "/charges", permission: "manage_settings" },
  { prefix: "/shifts", permission: "close_shift" },
  { prefix: "/attendance", permission: "access_attendance" },
  { prefix: "/settings", permission: "manage_settings" },
];

const HOME_PATH_ORDER = [
  "/pos",
  "/dashboard",
  "/reports",
  "/products",
  "/staff",
  "/discounts",
  "/shifts",
  "/attendance",
  "/settings",
  "/charges",
  "/table-assignments",
  "/audit-logs",
] as const;

function permissionForPath(path: string): string | undefined {
  const normalized = path.split("?")[0];
  const match = ROUTE_PERMISSIONS.find((r) => normalized === r.prefix || normalized.startsWith(`${r.prefix}/`));
  return match?.permission;
}

export function canAccessPath(path: string, permissions: string[]): boolean {
  const perm = permissionForPath(path);
  if (!perm) return true;
  return permissions.includes(perm);
}

/** Default landing page for a role after login or when a route is not allowed. */
export function getDefaultHomePath(role: string | undefined, permissions: string[]): string {
  const roleLower = String(role || "").toLowerCase();
  if (roleLower === "staff" || roleLower === "operations_staff") {
    return permissions.includes("manage_pos") ? "/pos" : "/dashboard";
  }

  for (const href of HOME_PATH_ORDER) {
    const perm = permissionForPath(href);
    if (!perm || permissions.includes(perm)) return href;
  }
  return "/dashboard";
}

/**
 * After login, only return to `from` if the new user may access that page.
 * Prevents e.g. waiter inheriting /audit-logs from the previous manager session.
 */
export function resolvePostLoginPath(
  role: string | undefined,
  permissions: string[],
  fromPath?: string | null
): string {
  const from = (fromPath || "").trim();
  if (from && from !== "/login" && from !== "/" && canAccessPath(from, permissions)) {
    return from;
  }
  return getDefaultHomePath(role, permissions);
}
