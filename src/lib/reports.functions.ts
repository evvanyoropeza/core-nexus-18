import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type DateRangeInput = { tenantId: string; from?: string | null; to?: string | null };

function normalizeRange(from?: string | null, to?: string | null, defaultDays = 30) {
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from ? new Date(from) : new Date();
  if (!from) fromDate.setDate(fromDate.getDate() - defaultDays + 1);
  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(23, 59, 59, 999);
  return { fromIso: fromDate.toISOString(), toIso: toDate.toISOString(), fromDate, toDate };
}

// -------- CUSTOMERS --------
export type CustomerReportRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  tags: string[];
  is_active: boolean;
  quotations_count: number;
  orders_count: number;
  total_sales: number;
};

export const getCustomersReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: DateRangeInput & { activeOnly?: boolean }) => i)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { fromIso, toIso } = normalizeRange(data.from, data.to, 90);
    let q = supabase
      .from("customers")
      .select("id, name, email, phone, city, tags, is_active")
      .eq("tenant_id", data.tenantId)
      .order("name");
    if (data.activeOnly) q = q.eq("is_active", true);
    const { data: customers, error } = await q;
    if (error) throw error;
    const ids = (customers ?? []).map((c) => c.id);
    if (ids.length === 0) return { rows: [] as CustomerReportRow[], range: { from: fromIso, to: toIso } };

    const [{ data: quotes }, { data: orders }] = await Promise.all([
      supabase
        .from("quotations")
        .select("customer_id, total, status, created_at")
        .eq("tenant_id", data.tenantId)
        .in("customer_id", ids)
        .gte("created_at", fromIso)
        .lte("created_at", toIso),
      supabase
        .from("sales_orders")
        .select("customer_id, total, status, created_at")
        .eq("tenant_id", data.tenantId)
        .in("customer_id", ids)
        .gte("created_at", fromIso)
        .lte("created_at", toIso),
    ]);

    const map = new Map<string, { q: number; o: number; total: number }>();
    for (const q of quotes ?? []) {
      const m = map.get(q.customer_id as string) ?? { q: 0, o: 0, total: 0 };
      m.q += 1;
      map.set(q.customer_id as string, m);
    }
    for (const o of orders ?? []) {
      const m = map.get(o.customer_id as string) ?? { q: 0, o: 0, total: 0 };
      m.o += 1;
      if (["confirmed", "in_progress", "fulfilled"].includes(o.status as string)) {
        m.total += Number(o.total ?? 0);
      }
      map.set(o.customer_id as string, m);
    }

    const rows: CustomerReportRow[] = (customers ?? []).map((c) => {
      const m = map.get(c.id) ?? { q: 0, o: 0, total: 0 };
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        city: c.city,
        tags: (c.tags ?? []) as string[],
        is_active: !!c.is_active,
        quotations_count: m.q,
        orders_count: m.o,
        total_sales: m.total,
      };
    });

    return { rows, range: { from: fromIso, to: toIso } };
  });

// -------- PRODUCTS --------
export type ProductReportRow = {
  id: string;
  sku: string;
  name: string;
  type: string;
  unit: string;
  list_price: number;
  cost: number;
  stock_current: number;
  stock_min: number;
  is_active: boolean;
  qty_sold: number;
  revenue: number;
};

export const getProductsReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: DateRangeInput & { lowStockOnly?: boolean }) => i)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { fromIso, toIso } = normalizeRange(data.from, data.to, 90);
    const { data: products, error } = await supabase
      .from("products")
      .select("id, sku, name, type, unit, list_price, cost, stock_current, stock_min, is_active")
      .eq("tenant_id", data.tenantId)
      .order("name");
    if (error) throw error;

    const { data: items } = await supabase
      .from("sales_order_items")
      .select("product_id, quantity, total, sales_orders!inner(tenant_id, status, created_at)")
      .eq("tenant_id", data.tenantId)
      .gte("sales_orders.created_at", fromIso)
      .lte("sales_orders.created_at", toIso);

    const sales = new Map<string, { qty: number; revenue: number }>();
    for (const it of items ?? []) {
      if (!it.product_id) continue;
      const cur = sales.get(it.product_id as string) ?? { qty: 0, revenue: 0 };
      cur.qty += Number(it.quantity ?? 0);
      cur.revenue += Number(it.total ?? 0);
      sales.set(it.product_id as string, cur);
    }

    let rows: ProductReportRow[] = (products ?? []).map((p) => {
      const s = sales.get(p.id) ?? { qty: 0, revenue: 0 };
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        type: p.type as string,
        unit: p.unit,
        list_price: Number(p.list_price ?? 0),
        cost: Number(p.cost ?? 0),
        stock_current: Number(p.stock_current ?? 0),
        stock_min: Number(p.stock_min ?? 0),
        is_active: !!p.is_active,
        qty_sold: s.qty,
        revenue: s.revenue,
      };
    });

    if (data.lowStockOnly) {
      rows = rows.filter((r) => r.type === "product" && r.stock_current <= r.stock_min);
    }

    return { rows, range: { from: fromIso, to: toIso } };
  });

// -------- INVENTORY MOVEMENTS --------
export type InventoryMovementRow = {
  id: string;
  created_at: string;
  product_id: string;
  sku: string;
  name: string;
  movement_type: string;
  quantity: number;
  resulting_stock: number | null;
  reason: string | null;
  reference: string | null;
};

export const getInventoryReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: DateRangeInput & { type?: string | null }) => i)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { fromIso, toIso } = normalizeRange(data.from, data.to, 30);
    let q = supabase
      .from("stock_movements")
      .select("id, created_at, product_id, movement_type, quantity, resulting_stock, reason, reference, products!inner(sku, name, tenant_id)")
      .eq("tenant_id", data.tenantId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (data.type) q = q.eq("movement_type", data.type as "entry" | "exit" | "adjustment");
    const { data: rows, error } = await q;
    if (error) throw error;

    const out: InventoryMovementRow[] = (rows ?? []).map((r) => ({
      id: r.id as string,
      created_at: r.created_at as string,
      product_id: r.product_id as string,
      sku: (r.products as { sku: string }).sku,
      name: (r.products as { name: string }).name,
      movement_type: r.movement_type as string,
      quantity: Number(r.quantity ?? 0),
      resulting_stock: r.resulting_stock == null ? null : Number(r.resulting_stock),
      reason: r.reason as string | null,
      reference: r.reference as string | null,
    }));
    return { rows: out, range: { from: fromIso, to: toIso } };
  });

// -------- QUOTATIONS --------
export type QuotationReportRow = {
  id: string;
  folio: string;
  issue_date: string;
  status: string;
  customer_name: string;
  subtotal: number;
  tax_amount: number;
  total: number;
};

export const getQuotationsReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: DateRangeInput & { status?: string | null }) => i)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { fromIso, toIso } = normalizeRange(data.from, data.to, 30);
    let q = supabase
      .from("quotations")
      .select("id, folio, issue_date, status, subtotal, tax_amount, total, customer_snapshot, created_at")
      .eq("tenant_id", data.tenantId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("issue_date", { ascending: false })
      .limit(1000);
    if (data.status) q = q.eq("status", data.status as "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted");
    const { data: rows, error } = await q;
    if (error) throw error;

    const out: QuotationReportRow[] = (rows ?? []).map((r) => ({
      id: r.id as string,
      folio: r.folio as string,
      issue_date: r.issue_date as string,
      status: r.status as string,
      customer_name: ((r.customer_snapshot ?? {}) as { name?: string }).name ?? "—",
      subtotal: Number(r.subtotal ?? 0),
      tax_amount: Number(r.tax_amount ?? 0),
      total: Number(r.total ?? 0),
    }));
    return { rows: out, range: { from: fromIso, to: toIso } };
  });

// -------- SALES ORDERS --------
export type SalesReportRow = {
  id: string;
  folio: string;
  issue_date: string;
  status: string;
  customer_name: string;
  subtotal: number;
  tax_amount: number;
  total: number;
};

export const getSalesReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: DateRangeInput & { status?: string | null }) => i)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { fromIso, toIso } = normalizeRange(data.from, data.to, 30);
    let q = supabase
      .from("sales_orders")
      .select("id, folio, issue_date, status, subtotal, tax_amount, total, customer_snapshot, created_at")
      .eq("tenant_id", data.tenantId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("issue_date", { ascending: false })
      .limit(1000);
    if (data.status) q = q.eq("status", data.status as "draft" | "confirmed" | "in_progress" | "fulfilled" | "cancelled");
    const { data: rows, error } = await q;
    if (error) throw error;

    const out: SalesReportRow[] = (rows ?? []).map((r) => ({
      id: r.id as string,
      folio: r.folio as string,
      issue_date: r.issue_date as string,
      status: r.status as string,
      customer_name: ((r.customer_snapshot ?? {}) as { name?: string }).name ?? "—",
      subtotal: Number(r.subtotal ?? 0),
      tax_amount: Number(r.tax_amount ?? 0),
      total: Number(r.total ?? 0),
    }));
    return { rows: out, range: { from: fromIso, to: toIso } };
  });
