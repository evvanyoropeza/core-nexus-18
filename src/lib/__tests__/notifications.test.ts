import { describe, expect, it } from "vitest";
import { buildNotifications, notificationAccess } from "../notifications";

const sources = {
  quotations: [{ id: "q1", folio: "COT-1", approval_status: "pending", approval_requested_at: "2026-11-11T19:00:00Z", updated_at: "2026-11-11T19:00:00Z" }],
  products: [{ id: "p1", name: "Motor", sku: "M1", type: "product", is_active: true, stock_current: 4, stock_min: 10, unit: "pza", updated_at: "2026-11-11T18:00:00Z" }],
  orders: [{ id: "o1", folio: "OV-1", status: "confirmed", updated_at: "2026-11-11T17:00:00Z" }],
};
describe("notificaciones operativas", () => {
  it("muestra solicitudes de autorización pendientes al administrador", () => {
    expect(buildNotifications("admin", sources).filter((n) => n.kind === "approval").map((n) => n.entityId)).toEqual(["q1"]);
  });
  it("retira las solicitudes aprobadas del centro", () => {
    expect(buildNotifications("admin", { ...sources, quotations: [{ ...sources.quotations[0], approval_status: "approved" }] }).some((n) => n.kind === "approval")).toBe(false);
  });
  it("limita ventas a avisos de despacho", () => {
    expect(buildNotifications("sales", sources).map((n) => n.kind)).toEqual(["dispatch"]);
  });
  it("limita almacén a inventario y despacho", () => {
    expect(buildNotifications("warehouse", sources).map((n) => n.kind)).toEqual(["stock", "dispatch"]);
  });
  it("no da avisos operativos a observadores ni roles desconocidos", () => {
    expect(notificationAccess("viewer")).toEqual({ approval: false, stock: false, dispatch: false });
    expect(buildNotifications("unknown", sources)).toEqual([]);
  });
  it("avisa por stock crítico a 4 unidades con mínimo de 10", () => {
    expect(buildNotifications("operations", sources).find((n) => n.kind === "stock")?.critical).toBe(true);
  });
  it("retira alertas de stock recuperado", () => {
    expect(buildNotifications("admin", { ...sources, products: [{ ...sources.products[0], stock_current: 11 }] }).some((n) => n.kind === "stock")).toBe(false);
  });
  it("retira órdenes surtidas y canceladas, conserva confirmadas y en proceso", () => {
    for (const status of ["fulfilled", "cancelled", "draft"]) {
      expect(buildNotifications("admin", { ...sources, orders: [{ ...sources.orders[0], status }] }).filter((n) => n.kind === "dispatch")).toEqual([]);
    }
    expect(buildNotifications("operations", { ...sources, orders: [{ ...sources.orders[0], status: "in_progress" }] }).filter((n) => n.kind === "dispatch")).toHaveLength(1);
  });
  it("renueva la identidad del aviso cuando cambia el nivel de stock", () => {
    const before = buildNotifications("admin", sources).find((n) => n.kind === "stock")?.key;
    const after = buildNotifications("admin", { ...sources, products: [{ ...sources.products[0], stock_current: 3 }] }).find((n) => n.kind === "stock")?.key;
    expect(after).not.toBe(before);
  });
});