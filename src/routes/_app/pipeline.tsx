import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, type DragEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { getPipeline, setQuotationStatus, type PipelineCard } from "@/lib/pipeline.functions";
import { formatMoney, STATUS_LABEL } from "@/lib/quotations";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/pipeline")({
  component: PipelinePage,
});

const COLUMNS: Array<{ key: "draft" | "sent" | "accepted" | "rejected"; tone: string }> = [
  { key: "draft", tone: "bg-muted/40" },
  { key: "sent", tone: "bg-blue-500/10" },
  { key: "accepted", tone: "bg-emerald-500/10" },
  { key: "rejected", tone: "bg-destructive/10" },
];

function PipelinePage() {
  const { currentTenant } = useAuth();
  const qc = useQueryClient();
  const fetchPipeline = useServerFn(getPipeline);
  const updateStatus = useServerFn(setQuotationStatus);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const { data: cards } = useQuery({
    queryKey: ["pipeline", currentTenant?.tenant_id],
    enabled: !!currentTenant,
    queryFn: () => fetchPipeline({ data: { tenantId: currentTenant!.tenant_id } }),
  });

  const grouped = useMemo(() => {
    const m: Record<string, PipelineCard[]> = {};
    for (const col of COLUMNS) m[col.key] = [];
    for (const c of cards ?? []) {
      if (m[c.status]) m[c.status].push(c);
    }
    return m;
  }, [cards]);

  const mutation = useMutation({
    mutationFn: (vars: { id: string; status: "draft" | "sent" | "accepted" | "rejected" }) =>
      updateStatus({ data: { quotationId: vars.id, status: vars.status } }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["pipeline", currentTenant?.tenant_id] });
      const prev = qc.getQueryData<PipelineCard[]>(["pipeline", currentTenant?.tenant_id]);
      qc.setQueryData<PipelineCard[]>(["pipeline", currentTenant?.tenant_id], (old) =>
        (old ?? []).map((c) => (c.id === vars.id ? { ...c, status: vars.status } : c)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["pipeline", currentTenant?.tenant_id], ctx.prev);
      toast.error("No se pudo actualizar");
    },
    onSuccess: () => toast.success("Estado actualizado"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["pipeline", currentTenant?.tenant_id] }),
  });

  function onDrop(e: DragEvent, status: typeof COLUMNS[number]["key"]) {
    e.preventDefault();
    setOverCol(null);
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    if (!id) return;
    const card = cards?.find((c) => c.id === id);
    if (!card || card.status === status) return;
    if (card.status === "converted") {
      toast.error("Una cotización convertida no se puede mover");
      return;
    }
    mutation.mutate({ id, status });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline comercial</h1>
        <p className="text-sm text-muted-foreground">
          Arrastra las cotizaciones entre etapas para actualizar su estado.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = grouped[col.key] ?? [];
          const total = items.reduce((s, c) => s + c.total, 0);
          const isOver = overCol === col.key;
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(col.key);
              }}
              onDragLeave={() => setOverCol((v) => (v === col.key ? null : v))}
              onDrop={(e) => onDrop(e, col.key)}
              className={`rounded-xl border ${col.tone} p-3 transition ${isOver ? "ring-2 ring-primary" : ""}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">{STATUS_LABEL[col.key]}</h3>
                  <p className="text-xs text-muted-foreground">{items.length} · {formatMoney(total)}</p>
                </div>
              </div>
              <div className="space-y-2 min-h-[120px]">
                {items.map((c) => (
                  <Card
                    key={c.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(c.id);
                      e.dataTransfer.setData("text/plain", c.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDragId(null)}
                    className={`cursor-grab active:cursor-grabbing p-3 shadow-sm hover:shadow-md transition ${dragId === c.id ? "opacity-50" : ""}`}
                  >
                    <Link to="/quotations/$quotationId" params={{ quotationId: c.id }} className="block space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{c.folio}</span>
                        <span className="text-sm font-semibold">{formatMoney(c.total)}</span>
                      </div>
                      <p className="text-sm font-medium truncate">{c.customer_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("es-MX")}
                      </p>
                    </Link>
                  </Card>
                ))}
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground/60 text-center py-6">
                    Suelta aquí
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {(grouped.converted?.length ?? 0) > 0 || (cards ?? []).some((c) => c.status === "converted" || c.status === "expired") ? (
        <div className="rounded-xl border border-dashed p-4">
          <h3 className="text-sm font-semibold mb-2">Cerradas (convertidas / expiradas)</h3>
          <div className="flex flex-wrap gap-2">
            {(cards ?? [])
              .filter((c) => c.status === "converted" || c.status === "expired")
              .slice(0, 20)
              .map((c) => (
                <Badge key={c.id} variant="outline" className="font-normal">
                  {c.folio} · {c.customer_name} · {formatMoney(c.total)}
                </Badge>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
