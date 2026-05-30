import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, Copy, FileDown, History, Link2, Loader2, Plus, Printer,
  Send, Share2, Trash2, CheckCircle2, XCircle,
} from "lucide-react";
import { useAuth, logAudit } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  createPublicToken,
  duplicateQuotation,
  listPublicTokens,
  listQuotationVersions,
  publicQuotationUrl,
  revokePublicToken,
  snapshotQuotationVersion,
  type QuotationPublicToken,
  type QuotationVersion,
} from "@/lib/quotation-actions";
import { generateQuotationPdf } from "@/lib/quotations.functions";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  type Quotation,
  type QuotationItem,
  type QuotationStatus,
  STATUS_LABEL,
  STATUS_VARIANT,
  fetchQuotation,
  fetchQuotationItems,
  formatMoney,
} from "@/lib/quotations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/quotations/$quotationId")({
  component: QuotationDetail,
});

interface ProductOpt {
  id: string;
  sku: string;
  name: string;
  unit: string;
  list_price: number;
  tax_rate: number;
}

function QuotationDetail() {
  const { quotationId } = Route.useParams();
  const { currentTenant, hasRole } = useAuth();
  const navigate = useNavigate();
  const canEdit = hasRole(["admin", "sales", "operations"]);

  const [q, setQ] = useState<Quotation | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [qd, it] = await Promise.all([fetchQuotation(quotationId), fetchQuotationItems(quotationId)]);
    setQ(qd);
    setItems(it);
  }, [quotationId]);

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [reload]);

  useEffect(() => {
    if (!currentTenant) return;
    supabase
      .from("products")
      .select("id, sku, name, unit, list_price, tax_rate")
      .eq("tenant_id", currentTenant.tenant_id)
      .eq("is_active", true)
      .order("name")
      .limit(500)
      .then(({ data }) => setProducts((data ?? []) as ProductOpt[]));
  }, [currentTenant]);

  if (loading || !q) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Cargando…
      </div>
    );
  }

  const snap = (q.customer_snapshot as Record<string, string | null>) ?? {};
  const isLocked = q.status !== "draft";

  const updateHeader = async (patch: Partial<Quotation>) => {
    const { error } = await supabase.from("quotations").update(patch).eq("id", q.id);
    if (error) return toast.error(error.message);
    await reload();
  };

  const addLine = async (product?: ProductOpt) => {
    if (!currentTenant) return;
    const { error } = await supabase.from("quotation_items").insert({
      tenant_id: currentTenant.tenant_id,
      quotation_id: q.id,
      product_id: product?.id ?? null,
      sku: product?.sku ?? null,
      name: product?.name ?? "Nuevo concepto",
      unit: product?.unit ?? "pza",
      quantity: 1,
      unit_price: product?.list_price ?? 0,
      tax_rate: product?.tax_rate ?? 16,
      discount_pct: 0,
      position: items.length,
    });
    if (error) return toast.error(error.message);
    await reload();
  };

  const updateLine = async (id: string, patch: Partial<QuotationItem>) => {
    const { error } = await supabase.from("quotation_items").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    await reload();
  };

  const removeLine = async (id: string) => {
    const { error } = await supabase.from("quotation_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await reload();
  };

  const changeStatus = async (status: QuotationStatus) => {
    const patch: Partial<Quotation> = { status };
    if (status === "sent") patch.sent_at = new Date().toISOString();
    if (status === "accepted" || status === "rejected") patch.decided_at = new Date().toISOString();
    await updateHeader(patch);
    await logAudit({
      tenantId: q.tenant_id,
      action: `quotation.${status}`,
      entityType: "quotation",
      entityId: q.id,
      metadata: { folio: q.folio },
    });
    toast.success(`Estado actualizado: ${STATUS_LABEL[status]}`);
  };

  const onDelete = async () => {
    const { error } = await supabase.from("quotations").delete().eq("id", q.id);
    if (error) return toast.error(error.message);
    await logAudit({
      tenantId: q.tenant_id, action: "quotation.delete", entityType: "quotation",
      entityId: q.id, metadata: { folio: q.folio },
    });
    toast.success("Cotización eliminada");
    navigate({ to: "/quotations" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/quotations" })}>
            <ArrowLeft className="mr-2 size-4" /> Listado
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{q.folio}</h1>
            <p className="text-sm text-muted-foreground">{snap.name ?? "Cliente"}</p>
          </div>
          <Badge variant={STATUS_VARIANT[q.status]}>{STATUS_LABEL[q.status]}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/quotations/$quotationId/print", params: { quotationId: q.id } })}>
            <Printer className="mr-2 size-4" /> Imprimir / PDF
          </Button>
          {canEdit && q.status === "draft" && (
            <Button size="sm" onClick={() => changeStatus("sent")}>
              <Send className="mr-2 size-4" /> Marcar enviada
            </Button>
          )}
          {canEdit && q.status === "sent" && (
            <>
              <Button size="sm" variant="default" onClick={() => changeStatus("accepted")}>
                <CheckCircle2 className="mr-2 size-4" /> Aceptada
              </Button>
              <Button size="sm" variant="destructive" onClick={() => changeStatus("rejected")}>
                <XCircle className="mr-2 size-4" /> Rechazada
              </Button>
            </>
          )}
          {hasRole("admin") && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline"><Trash2 className="mr-2 size-4" /> Eliminar</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar cotización</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. Se eliminará la cotización {q.folio} y todas sus líneas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Cabecera */}
      <Card>
        <CardHeader><CardTitle>Datos generales</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="Fecha de emisión">
            <Input type="date" disabled={isLocked || !canEdit} value={q.issue_date}
              onChange={(e) => updateHeader({ issue_date: e.target.value })} />
          </Field>
          <Field label="Válido hasta">
            <Input type="date" disabled={!canEdit} value={q.valid_until ?? ""}
              onChange={(e) => updateHeader({ valid_until: e.target.value || null })} />
          </Field>
          <Field label="Moneda">
            <Select value={q.currency} onValueChange={(v) => updateHeader({ currency: v })} disabled={isLocked || !canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MXN">MXN — Peso mexicano</SelectItem>
                <SelectItem value="USD">USD — Dólar</SelectItem>
                <SelectItem value="EUR">EUR — Euro</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Condiciones de pago">
            <Input disabled={!canEdit} value={q.payment_terms ?? ""} placeholder="Ej. 30 días"
              onChange={(e) => updateHeader({ payment_terms: e.target.value })} />
          </Field>
          <Field label="Condiciones de entrega">
            <Input disabled={!canEdit} value={q.delivery_terms ?? ""} placeholder="Ej. LAB Planta"
              onChange={(e) => updateHeader({ delivery_terms: e.target.value })} />
          </Field>
          <Field label="Descuento global %">
            <Input type="number" min="0" max="100" step="0.01" disabled={!canEdit}
              value={Number(q.discount_pct)}
              onChange={(e) => updateHeader({ discount_pct: Number(e.target.value) })} />
          </Field>
          <Field label="Notas para el cliente" className="md:col-span-3">
            <Textarea disabled={!canEdit} rows={2} value={q.notes ?? ""}
              onChange={(e) => updateHeader({ notes: e.target.value })} />
          </Field>
          <Field label="Notas internas (no se imprimen)" className="md:col-span-3">
            <Textarea disabled={!canEdit} rows={2} value={q.internal_notes ?? ""}
              onChange={(e) => updateHeader({ internal_notes: e.target.value })} />
          </Field>
        </CardContent>
      </Card>

      {/* Líneas */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Conceptos</CardTitle>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Select onValueChange={(id) => addLine(products.find((p) => p.id === id))}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Añadir desde catálogo…" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.sku} — {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => addLine()}>
                <Plus className="mr-2 size-4" /> Manual
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin conceptos. Añade al menos uno.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[280px]">Concepto</TableHead>
                    <TableHead className="w-20">Unidad</TableHead>
                    <TableHead className="w-24">Cant.</TableHead>
                    <TableHead className="w-32">P. unitario</TableHead>
                    <TableHead className="w-20">Desc. %</TableHead>
                    <TableHead className="w-20">IVA %</TableHead>
                    <TableHead className="w-32 text-right">Total</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell>
                        <Input disabled={!canEdit} value={it.name}
                          onChange={(e) => setItems((arr) => arr.map((x) => x.id === it.id ? { ...x, name: e.target.value } : x))}
                          onBlur={(e) => updateLine(it.id, { name: e.target.value })} />
                        {it.sku && <p className="mt-1 font-mono text-[11px] text-muted-foreground">{it.sku}</p>}
                      </TableCell>
                      <TableCell>
                        <Input disabled={!canEdit} value={it.unit}
                          onChange={(e) => setItems((arr) => arr.map((x) => x.id === it.id ? { ...x, unit: e.target.value } : x))}
                          onBlur={(e) => updateLine(it.id, { unit: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input disabled={!canEdit} type="number" step="0.01" value={Number(it.quantity)}
                          onChange={(e) => setItems((arr) => arr.map((x) => x.id === it.id ? { ...x, quantity: Number(e.target.value) } : x))}
                          onBlur={(e) => updateLine(it.id, { quantity: Number(e.target.value) })} />
                      </TableCell>
                      <TableCell>
                        <Input disabled={!canEdit} type="number" step="0.0001" value={Number(it.unit_price)}
                          onChange={(e) => setItems((arr) => arr.map((x) => x.id === it.id ? { ...x, unit_price: Number(e.target.value) } : x))}
                          onBlur={(e) => updateLine(it.id, { unit_price: Number(e.target.value) })} />
                      </TableCell>
                      <TableCell>
                        <Input disabled={!canEdit} type="number" step="0.01" value={Number(it.discount_pct)}
                          onChange={(e) => setItems((arr) => arr.map((x) => x.id === it.id ? { ...x, discount_pct: Number(e.target.value) } : x))}
                          onBlur={(e) => updateLine(it.id, { discount_pct: Number(e.target.value) })} />
                      </TableCell>
                      <TableCell>
                        <Input disabled={!canEdit} type="number" step="0.01" value={Number(it.tax_rate)}
                          onChange={(e) => setItems((arr) => arr.map((x) => x.id === it.id ? { ...x, tax_rate: Number(e.target.value) } : x))}
                          onBlur={(e) => updateLine(it.id, { tax_rate: Number(e.target.value) })} />
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatMoney(it.total, q.currency)}</TableCell>
                      <TableCell>
                        {canEdit && (
                          <Button variant="ghost" size="icon" onClick={() => removeLine(it.id)}>
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Totals q={q} />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={"space-y-1.5 " + (className ?? "")}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Totals({ q }: { q: Quotation }) {
  return (
    <div className="ml-auto w-full max-w-sm space-y-1.5 rounded-md border bg-muted/30 p-4 text-sm">
      <Row label="Subtotal" value={formatMoney(q.subtotal, q.currency)} />
      {Number(q.discount_amount) > 0 && (
        <Row label={`Descuento (${Number(q.discount_pct)}%)`} value={`- ${formatMoney(q.discount_amount, q.currency)}`} />
      )}
      <Row label="Impuestos" value={formatMoney(q.tax_amount, q.currency)} />
      <div className="my-2 border-t" />
      <Row label="Total" value={formatMoney(q.total, q.currency)} strong />
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={"flex items-center justify-between " + (strong ? "text-base font-semibold" : "")}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
