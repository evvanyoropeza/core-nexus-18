import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { getSalesReport } from "@/lib/reports.functions";
import { formatMoney } from "@/lib/quotations";
import { PeriodPicker, ReportShell, downloadCSV, todayISO, type Period } from "@/components/reports/ReportShell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/reports/sales")({
  component: SalesReport,
});

const ORDER_STATUS: Record<string, string> = {
  confirmed: "Confirmada",
  in_progress: "En proceso",
  fulfilled: "Surtida",
  cancelled: "Cancelada",
};

function SalesReport() {
  const { currentTenant } = useAuth();
  const [period, setPeriod] = useState<Period>({ from: todayISO(-29), to: todayISO() });
  const [status, setStatus] = useState("all");
  const fetchReport = useServerFn(getSalesReport);

  const { data, isLoading } = useQuery({
    queryKey: ["report", "sales", currentTenant?.tenant_id, period, status],
    enabled: !!currentTenant,
    queryFn: () =>
      fetchReport({
        data: {
          tenantId: currentTenant!.tenant_id,
          from: period.from, to: period.to,
          status: status === "all" ? null : status,
        },
      }),
  });

  const rows = data?.rows ?? [];
  const totals = useMemo(
    () => rows.reduce((a, r) => ({ s: a.s + r.subtotal, t: a.t + r.tax_amount, g: a.g + r.total }), { s: 0, t: 0, g: 0 }),
    [rows],
  );

  return (
    <ReportShell
      title="Reporte de Ventas"
      subtitle={`Periodo: ${period.from} → ${period.to} · ${rows.length} órdenes`}
      onExport={() =>
        downloadCSV(
          `ventas_${period.from}_${period.to}.csv`,
          ["Folio", "Fecha", "Cliente", "Estatus", "Subtotal", "Impuestos", "Total"],
          rows.map((r) => [r.folio, r.issue_date, r.customer_name, ORDER_STATUS[r.status] ?? r.status, r.subtotal.toFixed(2), r.tax_amount.toFixed(2), r.total.toFixed(2)]),
        )
      }
      filters={
        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <PeriodPicker value={period} onChange={setPeriod} />
          <div>
            <Label className="text-xs">Estatus</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(ORDER_STATUS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead className="text-right">IVA</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.folio}</TableCell>
                <TableCell>{r.issue_date}</TableCell>
                <TableCell>{r.customer_name}</TableCell>
                <TableCell><Badge variant="outline">{ORDER_STATUS[r.status] ?? r.status}</Badge></TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(r.subtotal)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(r.tax_amount)}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatMoney(r.total)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">Sin órdenes</TableCell></TableRow>
            )}
          </TableBody>
          {rows.length > 0 && (
            <tfoot className="border-t font-medium">
              <tr>
                <td colSpan={4} className="p-2 text-right">Totales</td>
                <td className="p-2 text-right tabular-nums">{formatMoney(totals.s)}</td>
                <td className="p-2 text-right tabular-nums">{formatMoney(totals.t)}</td>
                <td className="p-2 text-right tabular-nums">{formatMoney(totals.g)}</td>
              </tr>
            </tfoot>
          )}
        </Table>
      )}
    </ReportShell>
  );
}
