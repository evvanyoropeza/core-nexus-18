import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth, logAudit } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { generateFolio } from "@/lib/quotations";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/quotations/new")({
  component: NewQuotation,
});

interface CustomerOpt {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
}

function NewQuotation() {
  const { currentTenant, user } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentTenant) return;
    supabase
      .from("customers")
      .select("id, name, legal_name, tax_id, email, phone, address_line1, city, state, postal_code, country")
      .eq("tenant_id", currentTenant.tenant_id)
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setCustomers((data ?? []) as CustomerOpt[]));
  }, [currentTenant]);

  const onCreate = async () => {
    if (!currentTenant || !user || !customerId) return;
    setSaving(true);
    try {
      const folio = await generateFolio(currentTenant.tenant_id);
      const snap = customers.find((c) => c.id === customerId);
      const { data, error } = await supabase
        .from("quotations")
        .insert({
          tenant_id: currentTenant.tenant_id,
          folio,
          customer_id: customerId,
          customer_snapshot: snap ?? {},
          status: "draft",
          currency: currentTenant.tenant?.id ? "MXN" : "MXN",
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      await logAudit({
        tenantId: currentTenant.tenant_id,
        action: "quotation.create",
        entityType: "quotation",
        entityId: data.id,
        metadata: { folio },
      });
      toast.success(`Cotización ${folio} creada`);
      navigate({ to: "/quotations/$quotationId", params: { quotationId: data.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/quotations" })}>
        <ArrowLeft className="mr-2 size-4" /> Volver
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva cotización</h1>
        <p className="text-sm text-muted-foreground">Selecciona un cliente; podrás añadir productos en el siguiente paso.</p>
      </div>
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar cliente…" /></SelectTrigger>
              <SelectContent>
                {customers.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground">
                    No hay clientes activos. Crea uno primero.
                  </div>
                ) : (
                  customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.tax_id ? ` · ${c.tax_id}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate({ to: "/quotations" })} disabled={saving}>Cancelar</Button>
            <Button onClick={onCreate} disabled={!customerId || saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Crear borrador
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
