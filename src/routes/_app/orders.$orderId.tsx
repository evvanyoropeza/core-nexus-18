import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  Trash2,
  XCircle,
} from "lucide-react";
import { useAuth, logAudit } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchOrder,
  fetchOrderItems,
  formatMoney,
  fulfillmentPct,
  ORDER_NEXT_STATUS,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
  type SalesOrder,
  type SalesOrderItem,
  type SalesOrderStatus,
} from "@/lib/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/orders/$orderId")({
  component: OrderDetail,
});

function OrderDetail() {
  const { orderId } = Route.useParams();
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const canEdit = hasRole(["admin", "sales", "operations"]);

  const [o, setO] = useState<SalesOrder | null>(null);
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [od, it] = await Promise.all([fetchOrder(orderId), fetchOrderItems(orderId)]);
    setO(od);
    setItems(it);
  }, [orderId]);

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [reload]);

  if (loading || !o) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Cargando…
      </div>
    );
  }

  const snap = (o.customer_snapshot as Record<string, string | null>) ?? {};
  const isLocked = o.status === "fulfilled" || o.status === "cancelled";
  const allowedNext = ORDER_NEXT_STATUS[o.status] ?? [];

  const updateHeader = async (patch: Partial<SalesOrder>) => {
    const { error } = await supabase.from("sales_orders").update(patch).eq("id", o.id);
    if (error) return toast.error(error.message);
    await reload();
  };

  const updateLine = async (id: string, patch: Partial<SalesOrderItem>) => {
    const { error } = await supabase.from("sales_order_items").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    await reload();
  };

  const removeLine = async (id: string) => {
    const { error } = await supabase.from("sales_order_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await reload();
  };

  const changeStatus = async (status: SalesOrderStatus) => {
    const patch: Partial<SalesOrder> = { status };
    if (status === "confirmed" && !o.confirmed_at) patch.confirmed_at = new Date().toISOString();
    if (status === "fulfilled") patch.fulfilled_at = new Date().toISOString();
    if (status === "cancelled") patch.cancelled_at = new Date().toISOString();
    await updateHeader(patch);
    await logAudit({
      tenantId: o.tenant_id,
      action: `order.${status}`,
      entityType: "sales_order",
      entityId: o.id,
      metadata: { folio: o.folio },
    });
    toast.success(`Estado actualizado: ${ORDER_STATUS_LABEL[status]}`);
  };

  const fulfillAll = async () => {
    for (const it of items) {
      if (Number(it.quantity_fulfilled) !== Number(it.quantity)) {
        await supabase
          .from("sales_order_items")
          .update({ quantity_fulfilled: Number(it.quantity) })
          .eq("id", it.id);
      }
    }
    await changeStatus("fulfilled");
  };

  const onDelete = async () => {
    const { error } = await supabase.from("sales_orders").delete().eq("id", o.id);
    if (error) return toast.error(error.message);
    await logAudit({
      tenantId: o.tenant_id,
      action: "order.delete",
      entityType: "sales_order",
      entityId: o.id,
      metadata: { folio: o.folio },
    });
    toast.success("Orden eliminada");
    navigate({ to: "/orders" });
  };

  const progress = fulfillmentPct(items);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/orders" })}>
            <ArrowLeft className="mr-2 size-4" /> Listado
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{o.folio}</h1>
            <p className="text-sm text-muted-foreground">{snap.name ?? "Cliente"}</p>
          </div>
          <Badge variant={ORDER_STATUS_VARIANT[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {o.quotation_id && (
            <Button asChild variant="outline" size="sm">
              <Link
                to="/quotations/$quotationId"
                params={{ quotationId: o.quotation_id }}
              >
                <FileText className="mr-2 size-4" /> Cotización origen
              </Link>
            </Button>
          )}
          {canEdit &&
            allowedNext
              .filter((s) => s !== "cancelled")
              .map((s) => (
                <Button key={s} size="sm" onClick={() => changeStatus(s)}>
                  <CheckCircle2 className="mr-2 size-4" /> {ORDER_STATUS_LABEL[s]}
                </Button>
              ))}
          {canEdit && (o.status === "confirmed" || o.status === "in_progress") && (
            <Button size="sm" variant="outline" onClick={fulfillAll}>
              Marcar todo surtido
            </Button>
          )}
          {canEdit && allowedNext.includes("cancelled") && (
            <Button size="sm" variant="destructive" onClick={() => changeStatus("cancelled")}>
              <XCircle className="mr-2 size-4" /> Cancelar
            </Button>
          )}
          {hasRole("admin") && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Trash2 className="mr-2 size-4" /> Eliminar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar orden</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. Se eliminará la orden {o.folio} y todas sus
                    líneas.
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

      {/* Avance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avance de surtido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={progress} />
          <p className="text-sm text-muted-foreground">{progress}% surtido</p>
        </CardContent>
      </Card>

      {/* Cabecera */}
      <Card>
        <CardHeader>
          <CardTitle>Datos generales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="Fecha de emisión">
            <Input
              type="date"
              disabled={isLocked || !canEdit}
              value={o.issue_date}
              onChange={(e) => updateHeader({ issue_date: e.target.value })}
            />
          </Field>
          <Field label="Entrega estimada">
            <Input
              type="date"
              disabled={isLocked || !canEdit}
              value={o.expected_delivery_date ?? ""}
              onChange={(e) =>
                updateHeader({ expected_delivery_date: e.target.value || null })
              }
            />
          </Field>
          <Field label="Moneda">
            <Input disabled value={o.currency} />
          </Field>
          <Field label="Condiciones de pago">
            <Input
              disabled={isLocked || !canEdit}
              value={o.payment_terms ?? ""}
              onChange={(e) => updateHeader({ payment_terms: e.target.value })}
            />
          </Field>
          <Field label="Condiciones de entrega">
            <Input
              disabled={isLocked || !canEdit}
              value={o.delivery_terms ?? ""}
              onChange={(e) => updateHeader({ delivery_terms: e.target.value })}
            />
          </Field>
          <Field label="Descuento global %">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              disabled={isLocked || !canEdit}
              value={Number(o.discount_pct)}
              onChange={(e) => updateHeader({ discount_pct: Number(e.target.value) })}
            />
          </Field>
          <Field label="Notas para el cliente" className="md:col-span-3">
            <Textarea
              disabled={isLocked || !canEdit}
              rows={2}
              value={o.notes ?? ""}
              onChange={(e) => updateHeader({ notes: e.target.value })}
            />
          </Field>
          <Field label="Notas internas" className="md:col-span-3">
            <Textarea
              disabled={!canEdit}
              rows={2}
              value={o.internal_notes ?? ""}
              onChange={(e) => updateHeader({ internal_notes: e.target.value })}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Líneas */}
      <Card>
        <CardHeader>
          <CardTitle>Conceptos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin conceptos.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[260px]">Concepto</TableHead>
                    <TableHead className="w-20">Unidad</TableHead>
                    <TableHead className="w-24">Cant.</TableHead>
                    <TableHead className="w-28">Surtido</TableHead>
                    <TableHead className="w-32">P. unitario</TableHead>
                    <TableHead className="w-20">Desc. %</TableHead>
                    <TableHead className="w-20">IVA %</TableHead>
                    <TableHead className="w-32 text-right">Total</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => {
                    const fulfilled =
                      Number(it.quantity_fulfilled) >= Number(it.quantity) &&
                      Number(it.quantity) > 0;
                    return (
                      <TableRow key={it.id} className={fulfilled ? "bg-muted/30" : ""}>
                        <TableCell>
                          <Input
                            disabled={isLocked || !canEdit}
                            value={it.name}
                            onChange={(e) =>
                              setItems((arr) =>
                                arr.map((x) =>
                                  x.id === it.id ? { ...x, name: e.target.value } : x,
                                ),
                              )
                            }
                            onBlur={(e) => updateLine(it.id, { name: e.target.value })}
                          />
                          {it.sku && (
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                              {it.sku}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            disabled={isLocked || !canEdit}
                            value={it.unit}
                            onChange={(e) =>
                              setItems((arr) =>
                                arr.map((x) =>
                                  x.id === it.id ? { ...x, unit: e.target.value } : x,
                                ),
                              )
                            }
                            onBlur={(e) => updateLine(it.id, { unit: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            disabled={isLocked || !canEdit}
                            type="number"
                            step="0.01"
                            value={Number(it.quantity)}
                            onChange={(e) =>
                              setItems((arr) =>
                                arr.map((x) =>
                                  x.id === it.id
                                    ? { ...x, quantity: Number(e.target.value) }
                                    : x,
                                ),
                              )
                            }
                            onBlur={(e) =>
                              updateLine(it.id, { quantity: Number(e.target.value) })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            disabled={isLocked || !canEdit}
                            type="number"
                            step="0.01"
                            min="0"
                            max={Number(it.quantity)}
                            value={Number(it.quantity_fulfilled)}
                            onChange={(e) =>
                              setItems((arr) =>
                                arr.map((x) =>
                                  x.id === it.id
                                    ? { ...x, quantity_fulfilled: Number(e.target.value) }
                                    : x,
                                ),
                              )
                            }
                            onBlur={(e) =>
                              updateLine(it.id, {
                                quantity_fulfilled: Math.min(
                                  Number(it.quantity),
                                  Math.max(0, Number(e.target.value)),
                                ),
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            disabled={isLocked || !canEdit}
                            type="number"
                            step="0.0001"
                            value={Number(it.unit_price)}
                            onChange={(e) =>
                              setItems((arr) =>
                                arr.map((x) =>
                                  x.id === it.id
                                    ? { ...x, unit_price: Number(e.target.value) }
                                    : x,
                                ),
                              )
                            }
                            onBlur={(e) =>
                              updateLine(it.id, { unit_price: Number(e.target.value) })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            disabled={isLocked || !canEdit}
                            type="number"
                            step="0.01"
                            value={Number(it.discount_pct)}
                            onChange={(e) =>
                              setItems((arr) =>
                                arr.map((x) =>
                                  x.id === it.id
                                    ? { ...x, discount_pct: Number(e.target.value) }
                                    : x,
                                ),
                              )
                            }
                            onBlur={(e) =>
                              updateLine(it.id, { discount_pct: Number(e.target.value) })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            disabled={isLocked || !canEdit}
                            type="number"
                            step="0.01"
                            value={Number(it.tax_rate)}
                            onChange={(e) =>
                              setItems((arr) =>
                                arr.map((x) =>
                                  x.id === it.id
                                    ? { ...x, tax_rate: Number(e.target.value) }
                                    : x,
                                ),
                              )
                            }
                            onBlur={(e) =>
                              updateLine(it.id, { tax_rate: Number(e.target.value) })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatMoney(it.total, o.currency)}
                        </TableCell>
                        <TableCell>
                          {canEdit && !isLocked && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLine(it.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <Totals o={o} />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={"space-y-1.5 " + (className ?? "")}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Totals({ o }: { o: SalesOrder }) {
  return (
    <div className="ml-auto w-full max-w-sm space-y-1.5 rounded-md border bg-muted/30 p-4 text-sm">
      <Row label="Subtotal" value={formatMoney(o.subtotal, o.currency)} />
      {Number(o.discount_amount) > 0 && (
        <Row
          label={`Descuento (${Number(o.discount_pct)}%)`}
          value={`- ${formatMoney(o.discount_amount, o.currency)}`}
        />
      )}
      <Row label="Impuestos" value={formatMoney(o.tax_amount, o.currency)} />
      <div className="my-2 border-t" />
      <Row label="Total" value={formatMoney(o.total, o.currency)} strong />
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={
        "flex items-center justify-between " + (strong ? "text-base font-semibold" : "")
      }
    >
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
