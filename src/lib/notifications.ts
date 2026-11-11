import { getStockAlert } from "./stock-alerts";

export type NotificationKind = "approval" | "stock" | "dispatch";
export type InternalNotification = {
  key: string;
  kind: NotificationKind;
  entityId: string;
  title: string;
  detail: string;
  timestamp: string;
  critical: boolean;
};

export function notificationAccess(role: string | null | undefined) {
  const admin = ["admin", "superadmin", "owner"].includes(role ?? "");
  const operational = ["operations", "warehouse"].includes(role ?? "");
  return { approval: admin, stock: admin || operational, dispatch: admin || operational || role === "sales" };
}

type Sources = {
  quotations: { id: string; folio: string; approval_status: string; approval_requested_at: string | null; updated_at: string }[];
  products: { id: string; name: string; sku: string; type: string; is_active: boolean; stock_current: number; stock_min: number; unit: string; updated_at: string }[];
  orders: { id: string; folio: string; status: string; updated_at: string }[];
};

export function buildNotifications(role: string | undefined, sources: Sources): InternalNotification[] {
  const access = notificationAccess(role);
  const notifications: InternalNotification[] = [];
  if (access.approval) for (const q of sources.quotations) {
    if (q.approval_status !== "pending") continue;
    notifications.push({ key: `approval:${q.id}:${q.approval_requested_at ?? q.updated_at}`, kind: "approval", entityId: q.id,
      title: `${q.folio} · Descuento por autorizar`, detail: "Solicitud pendiente de revisión administrativa.",
      timestamp: q.approval_requested_at ?? q.updated_at, critical: false });
  }
  if (access.stock) for (const p of sources.products) {
    const alert = getStockAlert(p);
    if (!alert) continue;
    notifications.push({ key: `stock:${p.id}:${alert.current}:${alert.minimum}`, kind: "stock", entityId: p.id,
      title: `${p.name} · ${alert.status === "below_minimum" ? "Stock bajo" : "Punto de reorden"}`,
      detail: `${p.sku} · Existencias: ${alert.current} ${p.unit} · Mínimo: ${alert.minimum} ${p.unit}${alert.replenishment > 0 ? ` · Reponer: ${alert.replenishment} ${p.unit}` : ""}`,
      timestamp: p.updated_at, critical: alert.status === "below_minimum" });
  }
  if (access.dispatch) for (const o of sources.orders) {
    if (!["confirmed", "in_progress"].includes(o.status)) continue;
    notifications.push({ key: `dispatch:${o.id}:${o.status}`, kind: "dispatch", entityId: o.id,
      title: `${o.folio} · ${o.status === "confirmed" ? "Lista para surtir" : "Surtido en proceso"}`,
      detail: "Orden pendiente de completar el despacho.", timestamp: o.updated_at, critical: false });
  }
  return notifications.sort((a, b) => Number(b.critical) - Number(a.critical) || b.timestamp.localeCompare(a.timestamp));
}