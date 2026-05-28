import { createFileRoute, notFound } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2 } from "lucide-react";

import {
  downloadPublicQuotationPdf,
  fetchPublicQuotation,
} from "@/lib/quotations.functions";
import { formatMoney, STATUS_LABEL } from "@/lib/quotations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/q/$token")({
  component: PublicQuotationView,
  head: () => ({
    meta: [
      { title: "Cotización" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function PublicQuotationView() {
  const { token } = Route.useParams();
  const fetcher = useServerFn(fetchPublicQuotation);
  const downloader = useServerFn(downloadPublicQuotationPdf);

  const { data, isLoading } = useQuery({
    queryKey: ["public-quotation", token],
    queryFn: () => fetcher({ data: { token } }),
    retry: false,
  });

  const dlMutation = useMutation({
    mutationFn: async () => downloader({ data: { token } }),
    onSuccess: (res) => {
      if (res.signedUrl) {
        window.open(res.signedUrl, "_blank", "noopener");
      } else {
        toast.error("No se pudo generar el PDF");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Cargando cotización…
      </div>
    );
  }

  if (!data?.ok) {
    const reason = data?.reason === "expired" ? "Este enlace ha expirado." : "Enlace inválido o revocado.";
    throw notFound({ data: reason });
  }

  const { quotation: q, items, tenant, footer } = data;
  const snap = (q.customer_snapshot ?? {}) as Record<string, string | null>;
  const brand = tenant?.primary_color ?? "#635bff";

  return (
    <div className="min-h-screen bg-muted/40 py-8">
      <div className="mx-auto max-w-3xl space-y-4 px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Cotización compartida por <span className="font-medium text-foreground">{tenant?.name}</span>
          </div>
          <Button onClick={() => dlMutation.mutate()} disabled={dlMutation.isPending}>
            {dlMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Download className="mr-2 size-4" />
            )}
            Descargar PDF
          </Button>
        </div>

        <article className="overflow-hidden rounded-lg border bg-card shadow-sm">
          <header className="px-8 py-6 text-white" style={{ background: brand }}>
            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className="text-xl font-semibold">{tenant?.name}</h1>
                {tenant?.fiscal_id && (
                  <p className="mt-1 text-xs opacity-90">RFC: {tenant.fiscal_id}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide opacity-90">Cotización</p>
                <p className="text-lg font-semibold">{q.folio}</p>
                <Badge variant="secondary" className="mt-1 bg-white/20 text-white hover:bg-white/30">
                  {STATUS_LABEL[q.status as keyof typeof STATUS_LABEL]}
                </Badge>
              </div>
            </div>
          </header>

          <div className="grid gap-6 px-8 py-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Cliente</p>
              <p className="mt-1 font-semibold">{snap.name}</p>
              {snap.legal_name && snap.legal_name !== snap.name && (
                <p className="text-sm text-muted-foreground">{snap.legal_name}</p>
              )}
              {snap.tax_id && <p className="text-sm text-muted-foreground">RFC {snap.tax_id}</p>}
              {(snap.address_line1 || snap.city) && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {[snap.address_line1, snap.address_line2].filter(Boolean).join(", ")}
                  <br />
                  {[snap.city, snap.state, snap.postal_code].filter(Boolean).join(", ")}
                </p>
              )}
              {snap.email && <p className="text-sm text-muted-foreground">{snap.email}</p>}
              {snap.phone && <p className="text-sm text-muted-foreground">{snap.phone}</p>}
            </div>
            <div className="space-y-1 text-sm">
              <Meta label="Fecha de emisión" value={new Date(q.issue_date + "T00:00:00").toLocaleDateString("es-MX")} />
              <Meta
                label="Válido hasta"
                value={q.valid_until ? new Date(q.valid_until + "T00:00:00").toLocaleDateString("es-MX") : "—"}
              />
              <Meta label="Moneda" value={q.currency} />
              <Meta label="Pago" value={q.payment_terms ?? "—"} />
              <Meta label="Entrega" value={q.delivery_terms ?? "—"} />
            </div>
          </div>

          <div className="px-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="py-2 text-left">Concepto</th>
                  <th className="py-2 text-right">Cant.</th>
                  <th className="py-2 text-right">P. unit.</th>
                  <th className="py-2 text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b align-top">
                    <td className="py-2">
                      <p className="font-medium">{it.name}</p>
                      {it.sku && <p className="font-mono text-[11px] text-muted-foreground">{it.sku}</p>}
                    </td>
                    <td className="py-2 text-right">{Number(it.quantity)} {it.unit}</td>
                    <td className="py-2 text-right">{formatMoney(it.unit_price, q.currency)}</td>
                    <td className="py-2 text-right font-medium">{formatMoney(it.total, q.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end px-8 py-6">
            <div className="w-full max-w-xs space-y-1.5 text-sm">
              <Row label="Subtotal" value={formatMoney(q.subtotal, q.currency)} />
              {Number(q.discount_amount) > 0 && (
                <Row label={`Descuento (${Number(q.discount_pct)}%)`} value={`- ${formatMoney(q.discount_amount, q.currency)}`} />
              )}
              <Row label="Impuestos" value={formatMoney(q.tax_amount, q.currency)} />
              <div className="my-2 border-t" />
              <Row label="Total" value={formatMoney(q.total, q.currency)} strong />
            </div>
          </div>

          {q.notes && (
            <div className="border-t bg-muted/30 px-8 py-4 text-sm">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Notas</p>
              <p className="mt-1 whitespace-pre-line">{q.notes}</p>
            </div>
          )}

          {footer && (
            <footer className="border-t px-8 py-3 text-center text-xs text-muted-foreground">
              {footer}
            </footer>
          )}
        </article>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={"flex justify-between " + (strong ? "text-base font-semibold" : "")}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
