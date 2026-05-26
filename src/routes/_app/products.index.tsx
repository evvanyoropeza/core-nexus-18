import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, Package, Plus, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth, logAudit } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchProducts, fetchCategories, toCSV, parseCSV, downloadFile,
  productSchema, nullifyEmpty,
} from "@/lib/products";

export const Route = createFileRoute("/_app/products/")({
  component: ProductsPage,
});

function ProductsPage() {
  const { currentTenant, hasRole } = useAuth();
  const tenantId = currentTenant?.tenant_id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [type, setType] = useState<"all" | "product" | "service">("all");
  const [activeOnly, setActiveOnly] = useState(true);
  const [lowStock, setLowStock] = useState(false);
  const [importing, setImporting] = useState(false);

  const canEdit = hasRole(["admin", "sales", "operations"]);

  const { data: categories = [] } = useQuery({
    queryKey: ["product_categories", tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchCategories(tenantId!),
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", tenantId, search, tag, categoryId, type, activeOnly, lowStock],
    enabled: !!tenantId,
    queryFn: () => fetchProducts(tenantId!, {
      search,
      tag: tag === "all" ? null : tag,
      categoryId: categoryId === "all" ? null : categoryId,
      type: type === "all" ? null : type,
      activeOnly,
      lowStock,
    }),
  });

  const allTags = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [products]);

  const catMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const handleExport = () => {
    if (!products.length) { toast.info("Sin productos para exportar"); return; }
    downloadFile(`productos-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(products));
    toast.success(`Exportados ${products.length} productos`);
  };

  const handleImport = async (file: File) => {
    if (!tenantId) return;
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (!rows.length) { toast.error("CSV vacío"); return; }
      const valid: ReturnType<typeof productSchema.parse>[] = [];
      const errors: string[] = [];
      rows.forEach((r, i) => {
        const parsed = productSchema.safeParse({
          ...r,
          tags: r.tags ? r.tags.split("|").map((t) => t.trim()).filter(Boolean) : [],
          is_active: r.is_active === "false" ? false : true,
          type: r.type === "service" ? "service" : "product",
          unit: r.unit || "pza",
          list_price: r.list_price || 0,
          cost: r.cost || 0,
          tax_rate: r.tax_rate || 16,
          stock_min: r.stock_min || 0,
          stock_current: r.stock_current || 0,
        });
        if (parsed.success) valid.push(parsed.data);
        else errors.push(`Fila ${i + 2}: ${parsed.error.issues[0]?.message}`);
      });
      if (!valid.length) { toast.error(`Sin filas válidas. ${errors[0] ?? ""}`); return; }
      const payload = valid.map((v) => ({ ...nullifyEmpty(v), tenant_id: tenantId }));
      const { error } = await supabase.from("products").upsert(payload, { onConflict: "tenant_id,sku" });
      if (error) throw error;
      await logAudit({
        tenantId, action: "product.import", entityType: "product",
        metadata: { count: valid.length, errors: errors.length },
      });
      toast.success(`Importados ${valid.length} productos${errors.length ? ` (${errors.length} errores)` : ""}`);
      qc.invalidateQueries({ queryKey: ["products", tenantId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Package className="size-6" /> Productos y servicios
          </h1>
          <p className="text-sm text-muted-foreground">
            Catálogo, precios, inventario y categorías por empresa.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/products/categories" })}>
              Categorías
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" size="sm" disabled={importing} onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> Importar CSV
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-4" /> Exportar
          </Button>
          {canEdit && (
            <Button size="sm" onClick={() => navigate({ to: "/products/new" })}>
              <Plus className="size-4" /> Nuevo
            </Button>
          )}
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Buscar por SKU, nombre o descripción…"
              value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="product">Productos</SelectItem>
              <SelectItem value="service">Servicios</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tag} onValueChange={setTag}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tag" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tags</SelectItem>
              {allTags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch id="active" checked={activeOnly} onCheckedChange={setActiveOnly} />
            <Label htmlFor="active" className="text-sm">Solo activos</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="low" checked={lowStock} onCheckedChange={setLowStock} />
            <Label htmlFor="low" className="text-sm">Stock bajo</Label>
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
              ))
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  Sin productos. {canEdit && "Crea el primero o importa un CSV."}
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => {
                const isLow = p.type === "product" && Number(p.stock_current) <= Number(p.stock_min) && Number(p.stock_min) > 0;
                return (
                  <TableRow key={p.id} className="cursor-pointer"
                    onClick={() => navigate({ to: "/products/$productId", params: { productId: p.id } })}>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{p.type === "service" ? "Servicio" : "Producto"} · {p.unit}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.category_id ? catMap[p.category_id] ?? "—" : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      ${Number(p.list_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {p.type === "service" ? "—" : (
                        <span className={isLow ? "text-destructive font-medium inline-flex items-center gap-1" : ""}>
                          {isLow && <AlertTriangle className="size-3" />}
                          {Number(p.stock_current).toLocaleString()}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(p.tags ?? []).slice(0, 3).map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.is_active ? <Badge>Activo</Badge> : <Badge variant="outline">Inactivo</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <p className="text-xs text-muted-foreground">
        Mostrando {products.length} resultados. <Link to="/audit" className="underline">Ver historial</Link>.
      </p>
    </div>
  );
}
