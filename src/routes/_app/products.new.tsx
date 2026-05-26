import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/products/ProductForm";
import { useAuth, logAudit } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategories, nullifyEmpty, productSchema } from "@/lib/products";

export const Route = createFileRoute("/_app/products/new")({
  component: NewProductPage,
});

function NewProductPage() {
  const { currentTenant, user } = useAuth();
  const tenantId = currentTenant?.tenant_id;
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["product_categories", tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchCategories(tenantId!),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/products" })}>
        <ArrowLeft className="size-4" /> Volver
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo producto</h1>
        <p className="text-sm text-muted-foreground">Da de alta un producto o servicio en el catálogo.</p>
      </div>
      <ProductForm
        categories={categories}
        submitting={saving}
        onSubmit={async (values) => {
          if (!tenantId || !user) return;
          setSaving(true);
          try {
            const parsed = productSchema.parse(values);
            const payload = { ...nullifyEmpty(parsed), tenant_id: tenantId, created_by: user.id };
            const { data, error } = await supabase.from("products").insert(payload).select().single();
            if (error) throw error;
            await logAudit({
              tenantId, action: "product.create", entityType: "product",
              entityId: data.id, metadata: { sku: data.sku, name: data.name },
            });
            toast.success("Producto creado");
            navigate({ to: "/products/$productId", params: { productId: data.id } });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al crear");
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}
