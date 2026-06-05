import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Plus, Trash2, ArrowDownCircle, ArrowUpCircle, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ProductForm } from "@/components/products/ProductForm";
import { useAuth, logAudit } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchCategories, fetchPriceTiers, nullifyEmpty, productSchema, priceTierSchema,
  marginPct,
} from "@/lib/products";

type MovementType = "entry" | "exit" | "adjustment";

export const Route = createFileRoute("/_app/products/$productId")({
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { productId } = Route.useParams();
  const { currentTenant, hasRole, user } = useAuth();
  const tenantId = currentTenant?.tenant_id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const canEdit = hasRole(["admin", "sales", "operations"]);
  const canDelete = hasRole(["admin"]);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", productId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", productId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["product_categories", tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchCategories(tenantId!),
  });

  const { data: tiers = [] } = useQuery({
    queryKey: ["product_tiers", productId],
    enabled: !!productId,
    queryFn: () => fetchPriceTiers(productId),
  });

  const [tierQty, setTierQty] = useState("");
  const [tierPrice, setTierPrice] = useState("");

  if (isLoading) return <div className="text-sm text-muted-foreground">Cargando…</div>;
  if (!product) return <div className="text-sm text-muted-foreground">Producto no encontrado.</div>;

  const margin = marginPct(Number(product.list_price), Number(product.cost));

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/products" })}>
        <ArrowLeft className="size-4" /> Volver al catálogo
      </Button>

      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          <p className="text-sm text-muted-foreground font-mono">{product.sku}</p>
        </div>
        {canDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive"><Trash2 className="size-4" /> Eliminar</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
                <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    const { error } = await supabase.from("products").delete().eq("id", product.id);
                    if (error) { toast.error(error.message); return; }
                    await logAudit({ tenantId: tenantId!, action: "product.delete", entityType: "product", entityId: product.id, metadata: { sku: product.sku } });
                    toast.success("Producto eliminado");
                    navigate({ to: "/products" });
                  }}
                >Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Precio</div><div className="text-lg font-semibold tabular-nums">${Number(product.list_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Costo</div><div className="text-lg font-semibold tabular-nums">${Number(product.cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Margen</div><div className="text-lg font-semibold">{margin !== null ? `${margin.toFixed(1)}%` : "—"}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Stock</div><div className="text-lg font-semibold tabular-nums">{product.type === "service" ? "—" : Number(product.stock_current).toLocaleString()}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="pricing">Precios por volumen</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          {canEdit ? (
            <ProductForm
              initial={product}
              categories={categories}
              submitting={saving}
              onSubmit={async (values) => {
                setSaving(true);
                try {
                  const parsed = productSchema.parse(values);
                  const payload = nullifyEmpty(parsed);
                  const { error } = await supabase.from("products").update(payload).eq("id", product.id);
                  if (error) throw error;
                  await logAudit({ tenantId: tenantId!, action: "product.update", entityType: "product", entityId: product.id, metadata: { sku: parsed.sku } });
                  toast.success("Producto actualizado");
                  qc.invalidateQueries({ queryKey: ["product", productId] });
                  qc.invalidateQueries({ queryKey: ["products", tenantId] });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Error al guardar");
                } finally { setSaving(false); }
              }}
            />
          ) : (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">Solo lectura.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="pricing" className="mt-4 space-y-4">
          {canEdit && (
            <Card>
              <CardHeader><CardTitle className="text-base">Agregar escala de precio</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <Label>Cantidad mínima</Label>
                    <Input type="number" step="0.01" min="0" value={tierQty} onChange={(e) => setTierQty(e.target.value)} className="w-32" />
                  </div>
                  <div>
                    <Label>Precio unitario</Label>
                    <Input type="number" step="0.01" min="0" value={tierPrice} onChange={(e) => setTierPrice(e.target.value)} className="w-32" />
                  </div>
                  <Button
                    type="button"
                    onClick={async () => {
                      const parsed = priceTierSchema.safeParse({ min_quantity: tierQty, price: tierPrice });
                      if (!parsed.success) { toast.error(parsed.error.issues[0]?.message); return; }
                      const { error } = await supabase.from("product_price_tiers").insert({
                        tenant_id: tenantId!, product_id: product.id, ...parsed.data,
                      });
                      if (error) { toast.error(error.message); return; }
                      setTierQty(""); setTierPrice("");
                      qc.invalidateQueries({ queryKey: ["product_tiers", productId] });
                      toast.success("Escala agregada");
                    }}
                  ><Plus className="size-4" /> Agregar</Button>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cantidad ≥</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  {canEdit && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.length === 0 ? (
                  <TableRow><TableCell colSpan={canEdit ? 3 : 2} className="text-center py-6 text-muted-foreground text-sm">Sin escalas de precio.</TableCell></TableRow>
                ) : tiers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="tabular-nums">{Number(t.min_quantity).toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">${Number(t.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={async () => {
                          const { error } = await supabase.from("product_price_tiers").delete().eq("id", t.id);
                          if (error) { toast.error(error.message); return; }
                          qc.invalidateQueries({ queryKey: ["product_tiers", productId] });
                        }}><Trash2 className="size-4 text-destructive" /></Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
