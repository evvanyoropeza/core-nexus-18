import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/audit")({
  component: AuditPage,
});

function AuditPage() {
  const { currentTenant } = useAuth();
  const [q, setQ] = useState("");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs", currentTenant?.tenant_id],
    enabled: !!currentTenant,
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at, user_id")
        .eq("tenant_id", currentTenant!.tenant_id)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const filtered = (logs ?? []).filter((l) =>
    q ? `${l.action} ${l.entity_type ?? ""} ${JSON.stringify(l.metadata)}`.toLowerCase().includes(q.toLowerCase()) : true,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Actividad</h1>
          <p className="text-sm text-muted-foreground">Timeline cronológico de acciones en tu empresa.</p>
        </div>
        <Input placeholder="Buscar acción, entidad…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos {filtered.length} eventos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin actividad registrada todavía.</p>
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-6">
              {filtered.map((l) => (
                <li key={l.id} className="relative">
                  <span className="absolute -left-[27px] mt-1.5 size-2 rounded-full bg-primary ring-4 ring-background" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {l.action}
                    </Badge>
                    {l.entity_type ? (
                      <span className="text-xs text-muted-foreground">en {l.entity_type}</span>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      · {new Date(l.created_at).toLocaleString("es-MX")}
                    </span>
                  </div>
                  {l.metadata && Object.keys(l.metadata).length > 0 && (
                    <pre className="mt-1.5 max-w-2xl overflow-x-auto rounded bg-muted p-2 text-[11px] text-muted-foreground">
                      {JSON.stringify(l.metadata, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
