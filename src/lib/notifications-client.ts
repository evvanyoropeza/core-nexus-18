import { supabase } from "@/integrations/supabase/client";
import { buildNotifications, notificationAccess } from "./notifications";

// Paginate so the unread count does not silently stop at the Data API row limit.
async function allPages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await fetchPage(from, from + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}

export async function fetchNotifications(tenantId: string, userId: string, role: string) {
  const access = notificationAccess(role);
  const [quotations, products, orders, reads] = await Promise.all([
    access.approval ? allPages((from, to) => supabase.from("quotations")
      .select("id,folio,approval_status,approval_requested_at,updated_at").eq("tenant_id", tenantId)
      .eq("approval_status", "pending").order("id").range(from, to)) : [],
    access.stock ? allPages((from, to) => supabase.from("products")
      .select("id,name,sku,type,is_active,stock_current,stock_min,unit,updated_at").eq("tenant_id", tenantId)
      .eq("type", "product").eq("is_active", true).gt("stock_min", 0).order("id").range(from, to)) : [],
    access.dispatch ? allPages((from, to) => supabase.from("sales_orders")
      .select("id,folio,status,updated_at").eq("tenant_id", tenantId)
      .in("status", ["confirmed", "in_progress"]).order("id").range(from, to)) : [],
    allPages((from, to) => supabase.from("notification_reads").select("event_key")
      .eq("tenant_id", tenantId).eq("user_id", userId).order("event_key").range(from, to)),
  ]);
  const readKeys = new Set(reads.map((r) => r.event_key));
  return buildNotifications(role, { quotations, products, orders }).map((n) => ({ ...n, read: readKeys.has(n.key) }));
}

export async function markNotificationsRead(tenantId: string, userId: string, keys: string[]) {
  for (let start = 0; start < keys.length; start += 200) {
    const { error } = await supabase.from("notification_reads").upsert(
      keys.slice(start, start + 200).map((event_key) => ({ tenant_id: tenantId, user_id: userId, event_key })),
      { onConflict: "user_id,tenant_id,event_key", ignoreDuplicates: true },
    );
    if (error) throw error;
  }
}