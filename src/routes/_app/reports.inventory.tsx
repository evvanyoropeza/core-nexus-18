import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { getInventoryReport } from "@/lib/reports.functions";
import { PeriodPicker, ReportShell, downloadCSV, todayISO, type Period } from "@/components/reports/ReportShell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/reports/inventory")({
  component: InventoryReport,
});

const TYPE_LABEL: Record<string, string> = { entry: "Entrada", exit: "Salida", adjustment: "Ajuste" };

function InventoryReport() {
  const { currentTenant } = useAuth();
  const [period, setPeriod] = useState<Period>({ from: todayISO(-29), to: todayISO() });
  const [type, setType] = useState<string>("all");
  const fetchReport = useServerFn(getInventoryReport);

  const { data, isLoading } = useQuery({
    queryKey: ["report", "inventory", currentTenant?.tenant_id, period, type],
    enabled: !!currentTenant,
    queryFn: () =>
      fetchReport({
        data: {
          tenantId: currentTenant!.tenant_id,
          from: period.from, to: period.to,
          type: type === "all" ? null : type,
        },
      }),
  });

  const rows = data?.rows ?? [];
  const totals = useMemo(
    () => rows.reduce(
      (a, r) => {
        if (r.movement_type === "entry") a.entries += r.quantity;
        else if (r.movement_type === "exit") a.exits += r.quantity;
        else a.adj += 1;
        return a;
      },
      { entries: 0, exits: 0, adj: 0 },
    ),
    [rows],
  );

  return (
    <ReportShell
      title="Reporte de Inventario"
      subtitle={`Periodo: ${period.from} → ${period.to} · ${rows.length} movimientos`}
      onExport={() =>
        downloadCSV(
          `inventario_${period.from}_${period.to}.csv`,
          ["Fecha", "SKU", "Producto", "Tipo", "Cantidad", "Stock resultante", "Razón", "Referencia"],
          rows.map((r) => [new Date(r.created_at).toLocaleString(), r.sku, r.name, TYPE_LABEL[r.movement_type] ?? r.movement_type, r.quantity, r.resulting_stock ?? "", r.reason, r.reference]),
        )
      }
      filters={
        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <PeriodPicker value={period} onChange={setPeriod} />
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="entry">Entradas</SelectItem>
                <SelectItem value="exit">Salidas</SelectItem>
                <SelectItem value="adjustment">Ajustes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      }
    >
      <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-md border p-2"><div className="text-muted-foreground text-xs">Entradas</div><div className="font-semibold tabular-nums">{totals.entries}</div></div>
        <div className="rounded-md border p-2"><div className="text-muted-foreground text-xs">Salidas</div><div className="font-semibold tabular-nums">{totals.exits}</div></div>
        <div className="rounded-md border p-2"><div className="text-muted-foreground text-xs">Ajustes</div><div className="font-semibold tabular-nums">{totals.adj}</div></div>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Razón</TableHead>
              <TableHead>Ref.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  <div className="font-medium">{r.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{r.sku}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={r.movement_type === "exit" ? "destructive" : r.movement_type === "entry" ? "default" : "secondary"}>
                    {TYPE_LABEL[r.movement_type] ?? r.movement_type}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">{r.resulting_stock ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.reason ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.reference ?? "—"}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">Sin movimientos</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </ReportShell>
  );
}
