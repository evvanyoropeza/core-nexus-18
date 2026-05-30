import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SalesOrder = Database["public"]["Tables"]["sales_orders"]["Row"];
export type SalesOrderItem = Database["public"]["Tables"]["sales_order_items"]["Row"];
export type SalesOrderStatus = Database["public"]["Enums"]["sales_order_status"];

export const ORDER_STATUS_LABEL: Record<SalesOrderStatus, string> = {
  draft: "Borrador",
  confirmed: "Confirmada",
  in_progress: "En proceso",
  fulfilled: "Surtida",
  cancelled: "Cancelada",
};

export const ORDER_STATUS_VARIANT: Record<
  SalesOrderStatus,
  "secondary" | "default" | "destructive" | "outline"
> = {
  draft: "secondary",
  confirmed: "default",
  in_progress: "default",
  fulfilled: "default",
  cancelled: "destructive",
};

export const ORDER_NEXT_STATUS: Partial<Record<SalesOrderStatus, SalesOrderStatus[]>> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["fulfilled", "cancelled"],
  fulfilled: [],
  cancelled: [],
};

export function formatMoney(n: number | string | null | undefined, currency = "MXN") {
  const v = typeof n === "string" ? Number(n) : n ?? 0;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(v);
}

export async function fetchOrders(
  tenantId: string,
  opts: { search?: string; status?: SalesOrderStatus | null; customerId?: string | null },
) {
  let q = supabase
    .from("sales_orders")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.customerId) q = q.eq("customer_id", opts.customerId);
  if (opts.search?.trim()) {
    const s = `%${opts.search.trim()}%`;
    q = q.or(`folio.ilike.${s},notes.ilike.${s}`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchOrder(id: string) {
  const { data, error } = await supabase
    .from("sales_orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchOrderItems(orderId: string) {
  const { data, error } = await supabase
    .from("sales_order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function convertQuotationToOrder(quotationId: string): Promise<string> {
  const { data, error } = await supabase.rpc("convert_quotation_to_order", {
    _quotation_id: quotationId,
  });
  if (error) throw error;
  return data as string;
}

export function fulfillmentPct(items: SalesOrderItem[]): number {
  const totalQty = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
  if (totalQty <= 0) return 0;
  const done = items.reduce((s, i) => s + Number(i.quantity_fulfilled || 0), 0);
  return Math.min(100, Math.round((done / totalQty) * 100));
}
