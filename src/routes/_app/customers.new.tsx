import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth, logAudit } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { customerSchema, nullifyEmpty } from "@/lib/customers";
import { CustomerForm } from "@/components/customers/CustomerForm";

export const Route = createFileRoute("/_app/customers/new")({
  component: NewCustomerPage,
});

function NewCustomerPage() {
  const { currentTenant, user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  if (!hasRole(["admin", "sales", "operations"])) {
    return (
      <div className="space-y-4">
        <Link to="/customers" className="text-sm text-muted-foreground inline-flex items-center gap-1">
          <ArrowLeft className="size-4" /> Volver
        </Link>
        <p>No tienes permisos para crear clientes.</p>
      </div>
    );
  }

  const handleSubmit = async (values: unknown) => {
    if (!currentTenant || !user) return;
    const parsed = customerSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...nullifyEmpty(parsed.data),
        tenant_id: currentTenant.tenant_id,
        created_by: user.id,
      };
      const { data, error } = await supabase
        .from("customers")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      await logAudit({
        tenantId: currentTenant.tenant_id,
        action: "customer.create",
        entityType: "customer",
        entityId: data.id,
        metadata: { name: parsed.data.name },
      });
      toast.success("Cliente creado");
      navigate({ to: "/customers/$customerId", params: { customerId: data.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link to="/customers" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-4" /> Clientes
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">Nuevo cliente</h1>
      </div>
      <CustomerForm onSubmit={handleSubmit} submitting={saving} />
    </div>
  );
}
