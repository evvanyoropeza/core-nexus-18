import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDashboardKpis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const isoStart = startOfMonth.toISOString();

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const iso90 = ninetyDaysAgo.toISOString();

    // Cotizaciones del mes
    const { data: qCount, error: e1 } = await supabase
      .from("quotations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", data.tenantId)
      .gte("created_at", isoStart);
    if (e1) throw e1;

    // Revenue mensual (cotizaciones aceptadas + órdenes confirmadas)
    const { data: qRev, error: e2 } = await supabase
      .from("quotations")
      .select("total")
      .eq("tenant_id", data.tenantId)
      .in("status", ["accepted", "converted"])
      .gte("created_at", isoStart);
    if (e2) throw e2;

    const { data: oRev, error: e3 } = await supabase
      .from("sales_orders")
      .select("total")
      .eq("tenant_id", data.tenantId)
      .eq("status", "confirmed")
      .gte("created_at", isoStart);
    if (e3) throw e3;

    const revenue = (qRev ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0)
      + (oRev ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0);

    // Clientes activos (con cotización u orden en últimos 90 días)
    const { data: activeCustomers, error: e4 } = await supabase.rpc("count_active_customers", {
      _tenant_id: data.tenantId,
      _since: iso90,
    });
    if (e4) throw e4;

    // Productos en catálogo
    const { data: pCount, error: e5 } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", data.tenantId)
      .eq("is_active", true);
    if (e5) throw e5;

    return {
      quotationsMonth: qCount?.length ?? 0,
      revenueMonth: revenue,
      activeCustomers: activeCustomers ?? 0,
      activeProducts: pCount?.length ?? 0,
    };
  });
