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

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  sales: "Ventas",
  operations: "Operaciones",
  warehouse: "Almacén",
  finance: "Finanzas",
  viewer: "Solo lectura",
  superadmin: "Super Admin",
};
