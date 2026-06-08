import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { useSubscription, useIsOwner } from "@/lib/subscription";
import { listPlans, changePlan, cancelSubscription } from "@/lib/billing.functions";

export const Route = createFileRoute("/_app/billing")({
  component: BillingPage,
});

const FEATURE_LABELS: Record<string, string> = {
  customers: "Clientes",
  quotations: "Cotizaciones",
  orders: "Órdenes de venta",
  pipeline: "Pipeline comercial",
  reports: "Reportes",
  inventory: "Inventario",
  analytics: "Analíticas",
};

function BillingPage() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.tenant_id;
  const isOwner = useIsOwner();
  const subQ = useSubscription();
  const qc = useQueryClient();

  const fetchPlans = useServerFn(listPlans);
  const plansQ = useQuery({ queryKey: ["plans"], queryFn: () => fetchPlans() });

  const changeFn = useServerFn(changePlan);
  const cancelFn = useServerFn(cancelSubscription);

  const changeMut = useMutation({
    mutationFn: (planCode: string) => changeFn({ data: { tenantId: tenantId!, planCode } }),
    onSuccess: () => {
      toast.success("Plan actualizado");
      qc.invalidateQueries({ queryKey: ["subscription", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelFn({ data: { tenantId: tenantId! } }),
    onSuccess: () => {
      toast.success("Suscripción cancelada");
      qc.invalidateQueries({ queryKey: ["subscription", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sub = subQ.data?.subscription;
  const currentPlanCode = (sub?.plan as any)?.code;
  const usage = subQ.data?.usage;
  const usagePct = usage?.maxUsers ? (usage.activeUsers / usage.maxUsers) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Suscripción</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona tu plan, licencias y módulos contratados.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Plan actual: {(sub?.plan as any)?.name ?? "Sin plan"}
            {sub && <Badge variant={sub.status === "active" ? "default" : sub.status === "trial" ? "secondary" : "destructive"}>{sub.status}</Badge>}
          </CardTitle>
          <CardDescription>
            {sub?.status === "trial" && subQ.data?.trialDaysLeft != null
              ? `Prueba: ${subQ.data.trialDaysLeft} día(s) restantes`
              : sub?.end_date
                ? `Vence: ${new Date(sub.end_date).toLocaleDateString("es-MX")}`
                : "—"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span>Usuarios activos</span>
              <span className="font-medium">
                {usage?.activeUsers ?? 0}
                {usage?.maxUsers ? ` / ${usage.maxUsers}` : " (ilimitado)"}
              </span>
            </div>
            {usage?.maxUsers && <Progress value={usagePct} />}
          </div>
          {isOwner && sub?.status !== "cancelled" && (
            <Button variant="outline" size="sm" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}>
              Cancelar suscripción
            </Button>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Planes disponibles</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(plansQ.data ?? []).map((plan: any) => {
            const isCurrent = plan.code === currentPlanCode;
            return (
              <Card key={plan.id} className={isCurrent ? "border-primary" : ""}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {plan.name}
                    {isCurrent && <Badge>Actual</Badge>}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="pt-2 text-2xl font-bold">
                    ${Number(plan.price_monthly).toLocaleString("es-MX")}
                    <span className="text-sm font-normal text-muted-foreground"> /mes</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <strong>{plan.max_users ?? "∞"}</strong> usuarios
                  </div>
                  <ul className="space-y-1 text-sm">
                    {(plan.features as string[]).map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check className="size-4 text-primary" />
                        {FEATURE_LABELS[f] ?? f}
                      </li>
                    ))}
                  </ul>
                  {isOwner && !isCurrent && (
                    <Button
                      className="w-full"
                      onClick={() => changeMut.mutate(plan.code)}
                      disabled={changeMut.isPending}
                    >
                      <Sparkles className="mr-2 size-4" />
                      Cambiar a {plan.name}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
