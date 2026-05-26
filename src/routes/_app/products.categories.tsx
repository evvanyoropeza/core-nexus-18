import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth, logAudit } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategories, categorySchema } from "@/lib/products";

export const Route = createFileRoute("/_app/products/categories")({
  component: CategoriesPage,
});

function CategoriesPage() {
  const { currentTenant, hasRole } = useAuth();
  const tenantId = currentTenant?.tenant_id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canEdit = hasRole(["admin", "sales", "operations"]);
  const canDelete = hasRole(["admin"]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<string>("none");

  const { data: categories = [] } = useQuery({
    queryKey: ["product_categories", tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchCategories(tenantId!),
  });

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  const handleCreate = async () => {
    const parsed = categorySchema.safeParse({
      name, description, parent_id: parentId === "none" ? null : parentId, is_active: true,
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message); return; }
    const { data, error } = await supabase.from("product_categories")
      .insert({
        tenant_id: tenantId!,
        name: parsed.data.name,
        description: parsed.data.description || null,
        parent_id: parsed.data.parent_id ?? null,
        is_active: true,
      }).select().single();
    if (error) { toast.error(error.message); return; }
    await logAudit({ tenantId: tenantId!, action: "category.create", entityType: "product_category", entityId: data.id, metadata: { name } });
    setName(""); setDescription(""); setParentId("none");
    qc.invalidateQueries({ queryKey: ["product_categories", tenantId] });
    toast.success("Categoría creada");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/products" })}>
        <ArrowLeft className="size-4" /> Volver al catálogo
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categorías de productos</h1>
        <p className="text-sm text-muted-foreground">Organiza tu catálogo con jerarquía.</p>
      </div>

      {canEdit && (
        <Card>
          <CardHeader><CardTitle className="text-base">Nueva categoría</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </div>
            <div>
              <Label>Categoría padre</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin padre (raíz)</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="desc">Descripción</Label>
              <Textarea id="desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button onClick={handleCreate} disabled={!name.trim()}><Plus className="size-4" /> Crear</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Padre</TableHead>
              <TableHead>Descripción</TableHead>
              {canDelete && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow><TableCell colSpan={canDelete ? 4 : 3} className="text-center py-8 text-muted-foreground text-sm">Sin categorías.</TableCell></TableRow>
            ) : categories.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.parent_id ? catMap[c.parent_id] ?? "—" : "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-md truncate">{c.description ?? "—"}</TableCell>
                {canDelete && (
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={async () => {
                      const { error } = await supabase.from("product_categories").delete().eq("id", c.id);
                      if (error) { toast.error(error.message); return; }
                      await logAudit({ tenantId: tenantId!, action: "category.delete", entityType: "product_category", entityId: c.id, metadata: { name: c.name } });
                      qc.invalidateQueries({ queryKey: ["product_categories", tenantId] });
                      toast.success("Categoría eliminada");
                    }}><Trash2 className="size-4 text-destructive" /></Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
