import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  type Product, type ProductCategory, type ProductForm as PForm,
  UNITS, marginPct,
} from "@/lib/products";

interface Props {
  initial?: Partial<Product>;
  categories: ProductCategory[];
  submitting?: boolean;
  onSubmit: (values: PForm) => void | Promise<void>;
}

export function ProductForm({ initial, categories, submitting, onSubmit }: Props) {
  const [form, setForm] = useState<PForm>({
    sku: initial?.sku ?? "",
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    type: (initial?.type as "product" | "service") ?? "product",
    unit: initial?.unit ?? "pza",
    category_id: initial?.category_id ?? null,
    list_price: Number(initial?.list_price ?? 0),
    cost: Number(initial?.cost ?? 0),
    tax_rate: Number(initial?.tax_rate ?? 16),
    stock_min: Number(initial?.stock_min ?? 0),
    stock_current: Number(initial?.stock_current ?? 0),
    image_url: initial?.image_url ?? "",
    tags: initial?.tags ?? [],
    notes: initial?.notes ?? "",
    is_active: initial?.is_active ?? true,
  });
  const [tagInput, setTagInput] = useState("");

  const set = <K extends keyof PForm>(k: K, v: PForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || form.tags.includes(t) || form.tags.length >= 20) return;
    set("tags", [...form.tags, t]);
    setTagInput("");
  };
  const removeTag = (t: string) => set("tags", form.tags.filter((x) => x !== t));

  const margin = marginPct(form.list_price, form.cost);
  const isService = form.type === "service";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Información general</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="sku">SKU / Código *</Label>
            <Input id="sku" value={form.sku} onChange={(e) => set("sku", e.target.value)} required maxLength={60} />
          </div>
          <div>
            <Label htmlFor="name">Nombre *</Label>
            <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={200} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={form.type} onValueChange={(v) => set("type", v as "product" | "service")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="product">Producto</SelectItem>
                <SelectItem value="service">Servicio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Unidad de medida</Label>
            <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Categoría</Label>
            <Select
              value={form.category_id ?? "none"}
              onValueChange={(v) => set("category_id", v === "none" ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin categoría</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" rows={3} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} maxLength={2000} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Precios e impuestos</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="list_price">Precio de lista</Label>
            <Input id="list_price" type="number" step="0.01" min="0" value={form.list_price} onChange={(e) => set("list_price", Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="cost">Costo</Label>
            <Input id="cost" type="number" step="0.01" min="0" value={form.cost} onChange={(e) => set("cost", Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="tax_rate">IVA (%)</Label>
            <Input id="tax_rate" type="number" step="0.01" min="0" max="100" value={form.tax_rate} onChange={(e) => set("tax_rate", Number(e.target.value))} />
          </div>
          {margin !== null && (
            <div className="md:col-span-3 text-sm text-muted-foreground">
              Margen estimado: <span className={margin >= 0 ? "text-emerald-600 font-medium" : "text-destructive font-medium"}>{margin.toFixed(2)}%</span>
            </div>
          )}
        </CardContent>
      </Card>

      {!isService && (
        <Card>
          <CardHeader><CardTitle className="text-base">Inventario</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="stock_current">Stock actual</Label>
              <Input id="stock_current" type="number" value={form.stock_current} disabled readOnly />
              <p className="text-xs text-muted-foreground mt-1">
                El stock se modifica registrando movimientos en la pestaña <strong>Inventario</strong>.
              </p>
            </div>
            <div>
              <Label htmlFor="stock_min">Stock mínimo (alerta)</Label>
              <Input id="stock_min" type="number" step="0.01" min="0" value={form.stock_min} onChange={(e) => set("stock_min", Number(e.target.value))} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Etiquetas y metadatos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Etiquetas</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Agregar etiqueta y Enter"
                maxLength={40}
              />
              <Button type="button" variant="outline" onClick={addTag}>Agregar</Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {form.tags.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1">
                  {t}
                  <button type="button" onClick={() => removeTag(t)} className="hover:text-destructive"><X className="size-3" /></button>
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="image_url">URL de imagen</Label>
            <Input id="image_url" value={form.image_url ?? ""} onChange={(e) => set("image_url", e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label htmlFor="notes">Notas internas</Label>
            <Textarea id="notes" rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} maxLength={2000} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="is_active" checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
            <Label htmlFor="is_active">Activo</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={submitting}>{submitting ? "Guardando…" : "Guardar"}</Button>
      </div>
    </form>
  );
}
