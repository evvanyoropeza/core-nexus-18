import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Users, Package, TrendingUp, ArrowRight } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney, STATUS_LABEL } from "@/lib/quotations";
import { getDashboardKpis } from "@/lib/dashboard.functions";
import { getAnalytics } from "@/lib/analytics.functions";
import { OnboardingTour } from "@/components/help/OnboardingTour";
import { HelpHint } from "@/components/help/HelpHint";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

const kpiDefs = [
  {
    label: "Cotizaciones del mes",
    icon: FileText,
    help: "Número total de cotizaciones creadas en el mes en curso, sin importar su estado.",
    format: (v: number) => v.toLocaleString("es-MX"),
    key: "quotationsMonth" as const,
  },
  {
    label: "Revenue mensual",
    icon: TrendingUp,
    help: "Suma de cotizaciones aceptadas y órdenes confirmadas del mes, en moneda base.",
    format: (v: number) => formatMoney(v),
    key: "revenueMonth" as const,
  },
  {
    label: "Clientes activos",
    icon: Users,
    help: "Clientes con al menos una cotización u orden en los últimos 90 días.",
    format: (v: number) => v.toLocaleString("es-MX"),
    key: "activeCustomers" as const,
  },
  {
    label: "Productos en catálogo",
    icon: Package,
    help: "Total de productos activos disponibles para cotizar.",
    format: (v: number) => v.toLocaleString("es-MX"),
    key: "activeProducts" as const,
  },
];

function DashboardPage() {
  const { currentTenant, profile } = useAuth();
  const fetchKpis = useServerFn(getDashboardKpis);

  const { data: kpis } = useQuery({
    queryKey: ["dashboard-kpis", currentTenant?.tenant_id],
    enabled: !!currentTenant,
    queryFn: async () => {
      return fetchKpis({ data: { tenantId: currentTenant!.tenant_id } });
    },
  });

  const fetchAnalytics = useServerFn(getAnalytics);
  const { data: analytics } = useQuery({
    queryKey: ["dashboard-analytics", currentTenant?.tenant_id],
    enabled: !!currentTenant,
    queryFn: () => fetchAnalytics({ data: { tenantId: currentTenant!.tenant_id, days: 30 } }),
  });

  const { data: recent } = useQuery({
    queryKey: ["recent-audit", currentTenant?.tenant_id],
    enabled: !!currentTenant,
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, action, entity_type, metadata, created_at")
        .eq("tenant_id", currentTenant!.tenant_id)
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const funnelData = analytics
    ? [
        { stage: "Creadas", value: analytics.funnel.draft },
        { stage: "Enviadas", value: analytics.funnel.sent },
        { stage: "Aceptadas", value: analytics.funnel.accepted },
        { stage: "Convertidas", value: analytics.funnel.converted },
      ]
    : [];

  return (
    <div className="space-y-6">
      <OnboardingTour />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bienvenido, {profile?.full_name?.split(" ")[0] ?? "👋"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Panel ejecutivo de <span className="font-medium">{currentTenant?.tenant.name}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiDefs.map((k) => (
          <Card key={k.label} className="shadow-elev-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                {k.label}
                <HelpHint>{k.help}</HelpHint>
              </CardTitle>
              <k.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {kpis ? k.format(kpis[k.key]) : "—"}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Ingresos · últimos 30 días</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/analytics">
                Ver analíticas <ArrowRight className="ml-1 size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics?.salesByDay ?? []}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => new Date(v).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                  fontSize={11}
                />
                <YAxis fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => formatMoney(v)}
                  labelFormatter={(v) => new Date(v).toLocaleDateString("es-MX")}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#rev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Embudo</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/pipeline">
                Pipeline <ArrowRight className="ml-1 size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="stage" fontSize={11} width={80} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Conversión: <span className="font-semibold">{(analytics?.funnel.conversionRate ?? 0).toFixed(1)}%</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top clientes (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {(analytics?.topCustomers ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos aún.</p>
            ) : (
              <ul className="divide-y">
                {analytics!.topCustomers.map((c) => (
                  <li key={c.customer_id} className="flex items-center justify-between py-2 text-sm">
                    <span className="truncate">{c.name}</span>
                    <span className="font-semibold">{formatMoney(c.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
          </CardHeader>
          <CardContent>
            {recent && recent.length > 0 ? (
              <ul className="space-y-3">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0">
                      <p className="font-medium">{r.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("es-MX")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sin actividad aún.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
