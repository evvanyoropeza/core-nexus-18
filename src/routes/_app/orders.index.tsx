import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, ShoppingCart, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  fetchOrders,
  formatMoney,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
  type SalesOrder,
  type SalesOrderStatus,
} from "@/lib/orders";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/orders/")({
  component: OrdersList,
});

function OrdersList() {
  const { currentTenant } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SalesOrderStatus | "all">("all");

  useEffect(() => {
    if (!currentTenant) return;
    setLoading(true);
    fetchOrders(currentTenant.tenant_id, {
      search,
      status: status === "all" ? null : status,
    })
      .then(setRows)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [currentTenant, search, status]);

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.total), 0);
    const active = rows
      .filter((r) => r.status === "confirmed" || r.status === "in_progress")
      .reduce((s, r) => s + Number(r.total), 0);
    const pending = rows.filter(
      (r) => r.status === "confirmed" || r.status === "in_progress",
    ).length;
    return { total, active, pending, count: rows.length };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Órdenes de venta</h1>
          <p className="text-sm text-muted-foreground">
            Se crean al convertir una cotización aceptada.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KPI label="Total emitido" value={formatMoney(stats.total)} />
        <KPI label="En curso" value={formatMoney(stats.active)} />
        <KPI label="Por surtir" value={String(stats.pending)} />
        <KPI label="Documentos" value={String(stats.count)} />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Listado</CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar folio o notas…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-8"
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as SalesOrderStatus | "all")}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {(Object.keys(ORDER_STATUS_LABEL) as SalesOrderStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {ORDER_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Cargando…
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <ShoppingCart className="size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Aún no hay órdenes. Convierte una cotización para generar la primera.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Entrega</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const snap = (r.customer_snapshot as { name?: string } | null) ?? null;
                    return (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer"
                        onClick={() =>
                          navigate({
                            to: "/orders/$orderId",
                            params: { orderId: r.id },
                          })
                        }
                      >
                        <TableCell className="font-mono text-xs">{r.folio}</TableCell>
                        <TableCell className="font-medium">{snap?.name ?? "—"}</TableCell>
                        <TableCell>{r.issue_date}</TableCell>
                        <TableCell>{r.expected_delivery_date ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={ORDER_STATUS_VARIANT[r.status]}>
                            {ORDER_STATUS_LABEL[r.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatMoney(r.total, r.currency)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
