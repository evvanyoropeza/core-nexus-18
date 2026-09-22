import type { AppRole } from "@/lib/auth";

export type Permission =
  | "tenant.manage"
  | "users.manage"
  | "billing.manage"
  | "customers.write"
  | "products.write"
  | "quotations.write"
  | "orders.write"
  | "inventory.write"
  | "reports.read"
  | "analytics.read";

const MATRIX: Record<AppRole, Permission[]> = {
  superadmin: [
    "tenant.manage", "users.manage", "billing.manage",
    "customers.write", "products.write", "quotations.write", "orders.write",
    "inventory.write", "reports.read", "analytics.read",
  ],
  admin: [
    "tenant.manage", "users.manage", "billing.manage",
    "customers.write", "products.write", "quotations.write", "orders.write",
    "inventory.write", "reports.read", "analytics.read",
  ],
  sales: [
    "customers.write", "quotations.write", "orders.write",
    "reports.read", "analytics.read",
  ],
  operations: [
    "products.write", "orders.write", "inventory.write", "reports.read",
  ],
  finance: ["reports.read", "analytics.read"],
  viewer: ["reports.read"],
};

// Extended roles (not in original enum but treated specially)
const EXTRA: Record<string, Permission[]> = {
  warehouse: ["inventory.write", "products.write"],
  owner: MATRIX.admin,
};

export function rolePermissions(role: string): Permission[] {
  return (MATRIX as any)[role] ?? EXTRA[role] ?? [];
}

export function can(role: string | undefined | null, perm: Permission): boolean {
  if (!role) return false;
  return rolePermissions(role).includes(perm);
}

/* ----------------------------- Navegación por rol ---------------------------- */

export type NavKey =
  | "dashboard" | "customers" | "products" | "quotations" | "pipeline"
  | "orders" | "analytics" | "reports" | "team" | "billing" | "docs"
  | "audit" | "settings";

const ALL_NAV: NavKey[] = [
  "dashboard", "customers", "products", "quotations", "pipeline", "orders",
  "analytics", "reports", "team", "billing", "docs", "audit", "settings",
];

const NAV_ACCESS: Record<string, NavKey[]> = {
  superadmin: ALL_NAV,
  admin: ALL_NAV,
  owner: ALL_NAV,
  sales: ["dashboard", "customers", "quotations", "pipeline", "orders", "analytics", "reports", "docs"],
  operations: ["dashboard", "products", "orders", "reports", "docs"],
  warehouse: ["dashboard", "products", "orders", "docs"],
  finance: ["dashboard", "customers", "quotations", "orders", "analytics", "reports", "billing", "docs"],
  viewer: ["dashboard", "reports", "docs"],
};

export function canSeeNav(role: string | undefined | null, key: NavKey): boolean {
  if (!role) return false;
  return (NAV_ACCESS[role] ?? NAV_ACCESS.viewer).includes(key);
}

/** Costos base y márgenes son información sensible: ocultos para ventas y almacén. */
export function canViewCosts(role: string | undefined | null): boolean {
  if (!role) return false;
  return !["sales", "warehouse"].includes(role);
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  sales: "Ventas",
  operations: "Operaciones",
  warehouse: "Almacén",
  finance: "Finanzas",
  viewer: "Solo lectura",
  superadmin: "Super Admin",
};
