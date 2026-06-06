import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { getCustomersReport } from "@/lib/reports.functions";
import { formatMoney } from "@/lib/quotations";
import { PeriodPicker, ReportShell, downloadCSV, todayISO, type Period } from "@/components/reports/ReportShell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_app/reports/customers")({
  component: CustomersReport,
});

function CustomersReport() {
  const { currentTenant } = useAuth();
  const [period, setPeriod] = useState<Period>({ from: todayISO(-89), to: todayISO() });
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const fetchReport = useServerFn(getCustomersReport);

  const { data, isLoading } = useQuery({
    queryKey: ["report", "customers", currentTenant?.tenant_id, period, activeOnly],
    enabled: !!currentTenant,
    queryFn: () =>
      fetchReport({
        data: { tenantId: currentTenant!.tenant_id, from: period.from, to: period.to, activeOnly },
      }),
  });

  const rows = useMemo(() => {
    const r = data?.rows ?? [];
    const s = search.trim().toLowerCase();
    return s
      ? r.filter((x) => `${x.name} ${x.email ?? ""} ${x.city ?? ""}`.toLowerCase().includes(s))
      : r;
  }, [data, search]);

  const totals = useMemo(
    () => rows.reduce(
      (a, r) => ({ q: a.q + r.quotations_count, o: a.o + r.orders_count, s: a.s + r.total_sales }),
      { q: 0, o: 0, s: 0 },
    ),
    [rows],
  );

  return (
    <ReportShell
      title="Reporte de Clientes"
      subtitle={`Periodo: ${period.from} → ${period.to} · ${rows.length} clientes`}
      onExport={() =>
        downloadCSV(
          `clientes_${period.from}_${period.to}.csv`,
          ["Nombre", "Email", "Teléfono", "Ciudad", "Activo", "Cotizaciones", "Órdenes", "Ventas"],
          rows.map((r) => [r.name, r.email, r.phone, r.city, r.is_active ? "Sí" : "No", r.quotations_count, r.orders_count, r.total_sales.toFixed(2)]),
        )
      }
      filters={
        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <PeriodPicker value={period} onChange={setPeriod} />
          <div>
            <Label className="text-xs">Buscar</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, email…" className="h-9 w-[220px]" />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <Checkbox checked={activeOnly} onCheckedChange={(v) => setActiveOnly(!!v)} />
            Solo activos
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
              <TableHead>Cliente</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead className="text-right">Cotizaciones</TableHead>
              <TableHead className="text-right">Órdenes</TableHead>
              <TableHead className="text-right">Ventas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.email ?? "—"}<br />{r.phone ?? ""}
                </TableCell>
                <TableCell>{r.city ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.quotations_count}</TableCell>
                <TableCell className="text-right tabular-nums">{r.orders_count}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(r.total_sales)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Sin datos</TableCell></TableRow>
            )}
          </TableBody>
          {rows.length > 0 && (
            <tfoot className="border-t font-medium">
              <tr>
                <td colSpan={3} className="p-2 text-right">Totales</td>
                <td className="p-2 text-right tabular-nums">{totals.q}</td>
                <td className="p-2 text-right tabular-nums">{totals.o}</td>
                <td className="p-2 text-right tabular-nums">{formatMoney(totals.s)}</td>
              </tr>
            </tfoot>
          )}
        </Table>
      )}
    </ReportShell>
  );
}
