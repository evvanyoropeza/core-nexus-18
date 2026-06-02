import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Users, Package, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/quotations";
import { getDashboardKpis } from "@/lib/dashboard.functions";
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
          <CardHeader>
            <CardTitle>Pipeline comercial</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              Disponible en Fase 5 — Dashboards analíticos
            </div>
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
