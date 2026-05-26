import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Customer, CustomerForm as CForm } from "@/lib/customers";

interface Props {
  initial?: Partial<Customer>;
  submitting?: boolean;
  onSubmit: (values: CForm) => void | Promise<void>;
}

export function CustomerForm({ initial, submitting, onSubmit }: Props) {
  const [form, setForm] = useState<CForm>({
    name: initial?.name ?? "",
    legal_name: initial?.legal_name ?? "",
    tax_id: initial?.tax_id ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    website: initial?.website ?? "",
    address_line1: initial?.address_line1 ?? "",
    address_line2: initial?.address_line2 ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    country: initial?.country ?? "MX",
    postal_code: initial?.postal_code ?? "",
    notes: initial?.notes ?? "",
    tags: initial?.tags ?? [],
    credit_limit: Number(initial?.credit_limit ?? 0),
    credit_days: initial?.credit_days ?? 0,
    is_active: initial?.is_active ?? true,
  });
  const [tagInput, setTagInput] = useState("");

  const set = <K extends keyof CForm>(k: K, v: CForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || form.tags.includes(t) || form.tags.length >= 20) return;
    set("tags", [...form.tags, t]);
    setTagInput("");
  };
  const removeTag = (t: string) => set("tags", form.tags.filter((x) => x !== t));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card>
        <CardHeader><CardTitle className="text-base">Información general</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Nombre comercial *</Label>
            <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={200} />
          </div>
          <div>
            <Label htmlFor="legal_name">Razón social</Label>
            <Input id="legal_name" value={form.legal_name ?? ""} onChange={(e) => set("legal_name", e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label htmlFor="tax_id">RFC / Tax ID</Label>
            <Input id="tax_id" value={form.tax_id ?? ""} onChange={(e) => set("tax_id", e.target.value)} maxLength={40} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} maxLength={255} />
          </div>
          <div>
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} maxLength={40} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="website">Sitio web</Label>
            <Input id="website" value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} maxLength={255} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Dirección</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label htmlFor="addr1">Dirección</Label>
            <Input id="addr1" value={form.address_line1 ?? ""} onChange={(e) => set("address_line1", e.target.value)} maxLength={200} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="addr2">Dirección (línea 2)</Label>
            <Input id="addr2" value={form.address_line2 ?? ""} onChange={(e) => set("address_line2", e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label htmlFor="city">Ciudad</Label>
            <Input id="city" value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} maxLength={100} />
          </div>
          <div>
            <Label htmlFor="state">Estado</Label>
            <Input id="state" value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} maxLength={100} />
          </div>
          <div>
            <Label htmlFor="postal">Código postal</Label>
            <Input id="postal" value={form.postal_code ?? ""} onChange={(e) => set("postal_code", e.target.value)} maxLength={20} />
          </div>
          <div>
            <Label htmlFor="country">País (ISO)</Label>
            <Input id="country" value={form.country} onChange={(e) => set("country", e.target.value.toUpperCase())} maxLength={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Crédito y clasificación</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="credit_limit">Límite de crédito</Label>
            <Input id="credit_limit" type="number" min={0} step="0.01"
              value={form.credit_limit}
              onChange={(e) => set("credit_limit", Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="credit_days">Días de crédito</Label>
            <Input id="credit_days" type="number" min={0} max={365}
              value={form.credit_days}
              onChange={(e) => set("credit_days", Number(e.target.value))} />
          </div>
          <div className="sm:col-span-2">
            <Label>Tags</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="VIP, mayoreo, gobierno…"
                maxLength={40}
              />
              <Button type="button" variant="outline" onClick={addTag}>Agregar</Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {form.tags.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1">
                  {t}
                  <button type="button" onClick={() => removeTag(t)} aria-label={`Quitar ${t}`}>
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <Switch id="active" checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
            <Label htmlFor="active">Cliente activo</Label>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="notes">Notas internas</Label>
            <Textarea id="notes" rows={3} maxLength={2000}
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Guardando…" : "Guardar cliente"}
        </Button>
      </div>
    </form>
  );
}
