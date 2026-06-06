import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { getProductsReport } from "@/lib/reports.functions";
import { formatMoney } from "@/lib/quotations";
import { PeriodPicker, ReportShell, downloadCSV, todayISO, type Period } from "@/components/reports/ReportShell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_app/reports/products")({
  component: ProductsReport,
});

function ProductsReport() {
  const { currentTenant } = useAuth();
  const [period, setPeriod] = useState<Period>({ from: todayISO(-89), to: todayISO() });
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const fetchReport = useServerFn(getProductsReport);

  const { data, isLoading } = useQuery({
    queryKey: ["report", "products", currentTenant?.tenant_id, period, lowStockOnly],
    enabled: !!currentTenant,
    queryFn: () =>
      fetchReport({ data: { tenantId: currentTenant!.tenant_id, from: period.from, to: period.to, lowStockOnly } }),
  });

  const rows = useMemo(() => {
    const r = data?.rows ?? [];
    const s = search.trim().toLowerCase();
    return s ? r.filter((x) => `${x.sku} ${x.name}`.toLowerCase().includes(s)) : r;
  }, [data, search]);

  const totals = useMemo(
    () => rows.reduce((a, r) => ({ q: a.q + r.qty_sold, rev: a.rev + r.revenue }), { q: 0, rev: 0 }),
    [rows],
  );

  return (
    <ReportShell
      title="Reporte de Productos"
      subtitle={`Periodo: ${period.from} → ${period.to} · ${rows.length} productos`}
      onExport={() =>
        downloadCSV(
          `productos_${period.from}_${period.to}.csv`,
          ["SKU", "Nombre", "Tipo", "Unidad", "Precio lista", "Costo", "Stock", "Stock mín.", "Vendidos", "Ingresos"],
          rows.map((r) => [r.sku, r.name, r.type, r.unit, r.list_price.toFixed(2), r.cost.toFixed(2), r.stock_current, r.stock_min, r.qty_sold, r.revenue.toFixed(2)]),
        )
      }
      filters={
        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <PeriodPicker value={period} onChange={setPeriod} />
          <div>
            <Label className="text-xs">Buscar</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SKU o nombre" className="h-9 w-[220px]" />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <Checkbox checked={lowStockOnly} onCheckedChange={(v) => setLowStockOnly(!!v)} />
            Solo stock bajo
          </label>
        </div>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Vendidos</TableHead>
              <TableHead className="text-right">Ingresos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const low = r.type === "product" && r.stock_current <= r.stock_min;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="capitalize">{r.type}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.list_price)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${low ? "text-destructive font-medium" : ""}`}>
                    {r.type === "service" ? "—" : `${r.stock_current} ${r.unit}`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.qty_sold}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.revenue)}</TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">Sin datos</TableCell></TableRow>
            )}
          </TableBody>
          {rows.length > 0 && (
            <tfoot className="border-t font-medium">
              <tr>
                <td colSpan={5} className="p-2 text-right">Totales</td>
                <td className="p-2 text-right tabular-nums">{totals.q}</td>
                <td className="p-2 text-right tabular-nums">{formatMoney(totals.rev)}</td>
              </tr>
            </tfoot>
          )}
        </Table>
      )}
    </ReportShell>
  );
}
