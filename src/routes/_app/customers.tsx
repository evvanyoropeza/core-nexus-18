import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Download, Plus, Search, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth, logAudit } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchCustomers, toCSV, parseCSV, downloadFile, customerSchema, nullifyEmpty,
} from "@/lib/customers";

export const Route = createFileRoute("/_app/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const { currentTenant, hasRole } = useAuth();
  const tenantId = currentTenant?.tenant_id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string>("all");
  const [activeOnly, setActiveOnly] = useState(true);
  const [importing, setImporting] = useState(false);

  const canEdit = hasRole(["admin", "sales", "operations"]);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", tenantId, search, tag, activeOnly],
    enabled: !!tenantId,
    queryFn: () => fetchCustomers(tenantId!, {
      search, tag: tag === "all" ? null : tag, activeOnly,
    }),
  });

  const allTags = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => c.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [customers]);

  const handleExport = () => {
    if (!customers.length) {
      toast.info("Sin clientes para exportar");
      return;
    }
    downloadFile(`clientes-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(customers));
    toast.success(`Exportados ${customers.length} clientes`);
  };

  const handleImport = async (file: File) => {
    if (!tenantId) return;
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (!rows.length) {
        toast.error("CSV vacío");
        return;
      }
      const valid: ReturnType<typeof customerSchema.parse>[] = [];
      const errors: string[] = [];
      rows.forEach((r, i) => {
        const parsed = customerSchema.safeParse({
          ...r,
          tags: r.tags ? r.tags.split("|").map((t) => t.trim()).filter(Boolean) : [],
          is_active: r.is_active === "false" ? false : true,
          credit_limit: r.credit_limit || 0,
          credit_days: r.credit_days || 0,
          country: r.country || "MX",
        });
        if (parsed.success) valid.push(parsed.data);
        else errors.push(`Fila ${i + 2}: ${parsed.error.issues[0]?.message}`);
      });
      if (!valid.length) {
        toast.error(`Sin filas válidas. ${errors[0] ?? ""}`);
        return;
      }
      const payload = valid.map((v) => ({ ...nullifyEmpty(v), tenant_id: tenantId }));
      const { error } = await supabase.from("customers").insert(payload);
      if (error) throw error;
      await logAudit({
        tenantId, action: "customer.import", entityType: "customer",
        metadata: { count: valid.length, errors: errors.length },
      });
      toast.success(`Importados ${valid.length} clientes${errors.length ? ` (${errors.length} errores)` : ""}`);
      qc.invalidateQueries({ queryKey: ["customers", tenantId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="size-6" /> Clientes
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestión de cartera, contactos y crédito por empresa.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
          />
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              disabled={importing}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" /> Importar CSV
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-4" /> Exportar
          </Button>
          {canEdit && (
            <Button size="sm" onClick={() => navigate({ to: "/customers/new" })}>
              <Plus className="size-4" /> Nuevo cliente
            </Button>
          )}
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, razón social, email o RFC…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={tag} onValueChange={setTag}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tags</SelectItem>
              {allTags.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch id="active" checked={activeOnly} onCheckedChange={setActiveOnly} />
            <Label htmlFor="active" className="text-sm">Solo activos</Label>
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="text-right">Crédito</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                </TableRow>
              ))
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Sin clientes. {canEdit && "Crea el primero o importa un CSV."}
                </TableCell>
              </TableRow>
            ) : (
              customers.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => navigate({ to: "/customers/$customerId", params: { customerId: c.id } })}
                >
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    {c.legal_name && (
                      <div className="text-xs text-muted-foreground">{c.legal_name}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{c.email ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{c.phone ?? ""}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(c.tags ?? []).slice(0, 3).map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {c.credit_limit > 0 ? `$${Number(c.credit_limit).toLocaleString()} · ${c.credit_days}d` : "—"}
                  </TableCell>
                  <TableCell>
                    {c.is_active ? (
                      <Badge variant="default">Activo</Badge>
                    ) : (
                      <Badge variant="outline">Inactivo</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <p className="text-xs text-muted-foreground">
        Mostrando {customers.length} resultados. <Link to="/audit" className="underline">Ver historial</Link>.
      </p>
    </div>
  );
}
