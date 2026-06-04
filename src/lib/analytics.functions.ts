import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AnalyticsResult = {
  range: { days: number; from: string; to: string };
  salesByDay: Array<{ date: string; revenue: number; quotations: number }>;
  quotationsByStatus: Array<{ status: string; count: number; total: number }>;
  funnel: { draft: number; sent: number; accepted: number; converted: number; conversionRate: number };
  topCustomers: Array<{ customer_id: string; name: string; total: number; count: number }>;
  topProducts: Array<{ product_id: string | null; name: string; quantity: number; total: number }>;
};

export const getAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; days?: number }) => ({
    tenantId: input.tenantId,
    days: Math.max(1, Math.min(365, input.days ?? 30)),
  }))
  .handler(async ({ data, context }): Promise<AnalyticsResult> => {
    const { supabase } = context;
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - data.days + 1);
    from.setHours(0, 0, 0, 0);
    const isoFrom = from.toISOString();

    const [{ data: quotes, error: e1 }, { data: orders, error: e2 }, { data: qItems, error: e3 }] = await Promise.all([
      supabase
        .from("quotations")
        .select("id, status, total, customer_id, customer_snapshot, created_at")
        .eq("tenant_id", data.tenantId)
        .gte("created_at", isoFrom),
      supabase
        .from("sales_orders")
        .select("id, status, total, created_at")
        .eq("tenant_id", data.tenantId)
        .gte("created_at", isoFrom),
      supabase
        .from("quotation_items")
        .select("product_id, name, quantity, total, quotation_id, quotations!inner(tenant_id, created_at, status)")
        .eq("tenant_id", data.tenantId)
        .gte("quotations.created_at", isoFrom),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    if (e3) throw e3;

    // Sales by day (acceptable revenue = accepted/converted quotations + confirmed orders)
    const dayMap = new Map<string, { revenue: number; quotations: number }>();
    for (let i = 0; i < data.days; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      dayMap.set(d.toISOString().slice(0, 10), { revenue: 0, quotations: 0 });
    }
    for (const q of quotes ?? []) {
      const k = (q.created_at as string).slice(0, 10);
      const bucket = dayMap.get(k);
      if (!bucket) continue;
      bucket.quotations += 1;
      if (q.status === "accepted" || q.status === "converted") {
        bucket.revenue += Number(q.total ?? 0);
      }
    }
    for (const o of orders ?? []) {
      const k = (o.created_at as string).slice(0, 10);
      const bucket = dayMap.get(k);
      if (!bucket) continue;
      if (o.status === "confirmed" || o.status === "in_progress" || o.status === "fulfilled") {
        bucket.revenue += Number(o.total ?? 0);
      }
    }
    const salesByDay = Array.from(dayMap.entries()).map(([date, v]) => ({ date, ...v }));

    // Status breakdown
    const statusMap = new Map<string, { count: number; total: number }>();
    for (const q of quotes ?? []) {
      const s = q.status as string;
      const cur = statusMap.get(s) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(q.total ?? 0);
      statusMap.set(s, cur);
    }
    const quotationsByStatus = Array.from(statusMap.entries()).map(([status, v]) => ({ status, ...v }));

    // Funnel
    const drafts = (quotes ?? []).length;
    const sent = (quotes ?? []).filter((q) => ["sent", "accepted", "converted", "rejected"].includes(q.status as string)).length;
    const accepted = (quotes ?? []).filter((q) => ["accepted", "converted"].includes(q.status as string)).length;
    const converted = (quotes ?? []).filter((q) => q.status === "converted").length;
    const conversionRate = drafts > 0 ? (converted / drafts) * 100 : 0;

    // Top customers
    const custMap = new Map<string, { name: string; total: number; count: number }>();
    for (const q of quotes ?? []) {
      if (!q.customer_id) continue;
      if (!["accepted", "converted"].includes(q.status as string)) continue;
      const snap = (q.customer_snapshot ?? {}) as { name?: string };
      const cur = custMap.get(q.customer_id) ?? { name: snap.name ?? "—", total: 0, count: 0 };
      cur.total += Number(q.total ?? 0);
      cur.count += 1;
      custMap.set(q.customer_id, cur);
    }
    const topCustomers = Array.from(custMap.entries())
      .map(([customer_id, v]) => ({ customer_id, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Top products
    const prodMap = new Map<string, { name: string; quantity: number; total: number; product_id: string | null }>();
    for (const it of qItems ?? []) {
      const key = (it.product_id as string | null) ?? `__${it.name}`;
      const cur = prodMap.get(key) ?? { name: it.name as string, quantity: 0, total: 0, product_id: it.product_id as string | null };
      cur.quantity += Number(it.quantity ?? 0);
      cur.total += Number(it.total ?? 0);
      prodMap.set(key, cur);
    }
    const topProducts = Array.from(prodMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      range: { days: data.days, from: from.toISOString(), to: to.toISOString() },
      salesByDay,
      quotationsByStatus,
      funnel: { draft: drafts, sent, accepted, converted, conversionRate },
      topCustomers,
      topProducts,
    };
  });
