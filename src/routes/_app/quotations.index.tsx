import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, FileText, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  fetchQuotations,
  type Quotation,
  type QuotationStatus,
  STATUS_LABEL,
  STATUS_VARIANT,
  formatMoney,
} from "@/lib/quotations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/quotations/")({
  component: QuotationsList,
});

function QuotationsList() {
  const { currentTenant } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QuotationStatus | "all">("all");

  useEffect(() => {
    if (!currentTenant) return;
    setLoading(true);
    fetchQuotations(currentTenant.tenant_id, {
      search,
      status: status === "all" ? null : status,
    })
      .then(setRows)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [currentTenant, search, status]);

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.total), 0);
    const accepted = rows.filter((r) => r.status === "accepted").reduce((s, r) => s + Number(r.total), 0);
    const open = rows.filter((r) => r.status === "draft" || r.status === "sent").length;
    return { total, accepted, open, count: rows.length };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cotizaciones</h1>
          <p className="text-sm text-muted-foreground">Genera, envía y da seguimiento a propuestas comerciales.</p>
        </div>
        <Button onClick={() => navigate({ to: "/quotations/new" })}>
          <Plus className="mr-2 size-4" /> Nueva cotización
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KPI label="Total emitido" value={formatMoney(stats.total)} />
        <KPI label="Aceptadas" value={formatMoney(stats.accepted)} />
        <KPI label="Abiertas" value={String(stats.open)} />
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
            <Select value={status} onValueChange={(v) => setStatus(v as QuotationStatus | "all")}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {(Object.keys(STATUS_LABEL) as QuotationStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
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
              <FileText className="size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Aún no hay cotizaciones</p>
              <Button size="sm" onClick={() => navigate({ to: "/quotations/new" })}>
                Crear la primera
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const snap = (r.customer_snapshot as { name?: string } | null) ?? null;
                    return (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate({ to: "/quotations/$quotationId", params: { quotationId: r.id } })}>
                        <TableCell className="font-mono text-xs">{r.folio}</TableCell>
                        <TableCell className="font-medium">{snap?.name ?? "—"}</TableCell>
                        <TableCell>{r.issue_date}</TableCell>
                        <TableCell>{r.valid_until ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatMoney(r.total, r.currency)}</TableCell>
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
