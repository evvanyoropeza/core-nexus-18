import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { getAnalytics } from "@/lib/analytics.functions";
import { formatMoney, STATUS_LABEL } from "@/lib/quotations";

export const Route = createFileRoute("/_app/analytics")({
  component: AnalyticsPage,
});

const RANGES = [
  { d: 7, label: "7d" },
  { d: 30, label: "30d" },
  { d: 90, label: "90d" },
  { d: 365, label: "YTD" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "hsl(var(--muted-foreground))",
  sent: "hsl(217 91% 60%)",
  accepted: "hsl(142 71% 45%)",
  rejected: "hsl(0 84% 60%)",
  expired: "hsl(38 92% 50%)",
  converted: "hsl(262 83% 58%)",
};

function AnalyticsPage() {
  const { currentTenant } = useAuth();
  const [days, setDays] = useState(30);
  const fetchAnalytics = useServerFn(getAnalytics);

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", currentTenant?.tenant_id, days],
    enabled: !!currentTenant,
    queryFn: () => fetchAnalytics({ data: { tenantId: currentTenant!.tenant_id, days } }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analíticas</h1>
          <p className="text-sm text-muted-foreground">Tendencias y desempeño comercial.</p>
        </div>
        <div className="flex gap-1 rounded-lg border p-1">
          {RANGES.map((r) => (
            <Button
              key={r.d}
              size="sm"
              variant={days === r.d ? "default" : "ghost"}
              onClick={() => setDays(r.d)}
              className="h-7 px-3"
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Cotizaciones" value={data?.funnel.draft ?? 0} />
        <KpiCard label="Aceptadas" value={data?.funnel.accepted ?? 0} />
        <KpiCard label="Convertidas" value={data?.funnel.converted ?? 0} />
        <KpiCard
          label="Tasa conversión"
          value={`${(data?.funnel.conversionRate ?? 0).toFixed(1)}%`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ingresos diarios</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.salesByDay ?? []}>
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
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Por estado</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.quotationsByStatus ?? []}
                  dataKey="count"
                  nameKey="status"
                  outerRadius={80}
                  label={(e) => STATUS_LABEL[e.status as keyof typeof STATUS_LABEL] ?? e.status}
                >
                  {(data?.quotationsByStatus ?? []).map((s) => (
                    <Cell key={s.status} fill={STATUS_COLORS[s.status] ?? "hsl(var(--primary))"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Embudo de conversión</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={[
                  { stage: "Creadas", value: data?.funnel.draft ?? 0 },
                  { stage: "Enviadas", value: data?.funnel.sent ?? 0 },
                  { stage: "Aceptadas", value: data?.funnel.accepted ?? 0 },
                  { stage: "Convertidas", value: data?.funnel.converted ?? 0 },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="stage" fontSize={11} width={90} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top clientes</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.topCustomers ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos en el rango.</p>
            ) : (
              <ul className="space-y-2">
                {data!.topCustomers.map((c) => (
                  <li key={c.customer_id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{c.name}</span>
                    <span className="font-semibold">{formatMoney(c.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top productos</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.topProducts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos en el rango.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {data!.topProducts.map((p, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">Cant: {p.quantity.toLocaleString("es-MX")}</p>
                  <p className="text-sm font-semibold mt-1">{formatMoney(p.total)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading && <p className="text-xs text-muted-foreground">Cargando…</p>}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="shadow-elev-sm">
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
