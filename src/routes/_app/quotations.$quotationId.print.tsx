import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  type Quotation, type QuotationItem,
  STATUS_LABEL, fetchQuotation, fetchQuotationItems, formatMoney,
} from "@/lib/quotations";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/quotations/$quotationId/print")({
  component: PrintView,
});

interface OrgSettings {
  pdf_footer: string | null;
  branding: Record<string, unknown> | null;
}

function PrintView() {
  const { quotationId } = Route.useParams();
  const { currentTenant } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState<Quotation | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [org, setOrg] = useState<OrgSettings | null>(null);

  useEffect(() => {
    if (!currentTenant) return;
    Promise.all([
      fetchQuotation(quotationId),
      fetchQuotationItems(quotationId),
      supabase.from("organization_settings").select("pdf_footer, branding").eq("tenant_id", currentTenant.tenant_id).maybeSingle(),
    ]).then(([a, b, c]) => {
      setQ(a); setItems(b); setOrg((c.data as OrgSettings) ?? null);
    });
  }, [quotationId, currentTenant]);

  if (!q || !currentTenant) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" /> Cargando…</div>;
  }

  const tenant = currentTenant.tenant;
  const snap = (q.customer_snapshot as Record<string, string | null>) ?? {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/quotations/$quotationId", params: { quotationId } })}>
          <ArrowLeft className="mr-2 size-4" /> Volver
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 size-4" /> Imprimir / Guardar PDF
        </Button>
      </div>

      <div className="mx-auto max-w-4xl rounded-lg border bg-card p-10 text-card-foreground shadow-sm print:border-0 print:shadow-none">
        <header className="flex items-start justify-between border-b pb-6">
          <div>
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="mb-3 h-12 object-contain" />
            ) : (
              <h1 className="text-2xl font-bold" style={{ color: tenant.primary_color ?? undefined }}>{tenant.name}</h1>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Cotización</p>
            <p className="font-mono text-lg font-semibold">{q.folio}</p>
            <p className="mt-1 text-xs text-muted-foreground">Estado: {STATUS_LABEL[q.status]}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 py-6 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente</p>
            <p className="font-semibold">{snap.name ?? "—"}</p>
            {snap.legal_name && <p>{snap.legal_name}</p>}
            {snap.tax_id && <p>RFC: {snap.tax_id}</p>}
            {snap.address_line1 && <p>{snap.address_line1}</p>}
            {(snap.city || snap.state) && <p>{[snap.city, snap.state, snap.postal_code].filter(Boolean).join(", ")}</p>}
            {snap.email && <p>{snap.email}</p>}
            {snap.phone && <p>{snap.phone}</p>}
          </div>
          <div className="text-right">
            <p><span className="text-muted-foreground">Fecha:</span> {q.issue_date}</p>
            {q.valid_until && <p><span className="text-muted-foreground">Vigencia:</span> {q.valid_until}</p>}
            <p><span className="text-muted-foreground">Moneda:</span> {q.currency}</p>
            {q.payment_terms && <p><span className="text-muted-foreground">Pago:</span> {q.payment_terms}</p>}
            {q.delivery_terms && <p><span className="text-muted-foreground">Entrega:</span> {q.delivery_terms}</p>}
          </div>
        </section>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y bg-muted/50 text-left">
              <th className="px-2 py-2 font-medium">#</th>
              <th className="px-2 py-2 font-medium">Concepto</th>
              <th className="px-2 py-2 text-right font-medium">Cant.</th>
              <th className="px-2 py-2 font-medium">Unidad</th>
              <th className="px-2 py-2 text-right font-medium">P. Unit.</th>
              <th className="px-2 py-2 text-right font-medium">Importe</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id} className="border-b align-top">
                <td className="px-2 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-2 py-2">
                  <p className="font-medium">{it.name}</p>
                  {it.description && <p className="text-xs text-muted-foreground">{it.description}</p>}
                  {it.sku && <p className="font-mono text-[10px] text-muted-foreground">{it.sku}</p>}
                </td>
                <td className="px-2 py-2 text-right">{Number(it.quantity)}</td>
                <td className="px-2 py-2">{it.unit}</td>
                <td className="px-2 py-2 text-right">{formatMoney(it.unit_price, q.currency)}</td>
                <td className="px-2 py-2 text-right">{formatMoney(it.subtotal, q.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-6 flex justify-end">
          <div className="w-72 space-y-1 text-sm">
            <Row label="Subtotal" value={formatMoney(q.subtotal, q.currency)} />
            {Number(q.discount_amount) > 0 && <Row label={`Descuento (${Number(q.discount_pct)}%)`} value={`- ${formatMoney(q.discount_amount, q.currency)}`} />}
            <Row label="Impuestos" value={formatMoney(q.tax_amount, q.currency)} />
            <div className="my-1 border-t" />
            <Row label="Total" value={formatMoney(q.total, q.currency)} strong />
          </div>
        </section>

        {q.notes && (
          <section className="mt-6 border-t pt-4 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notas</p>
            <p className="whitespace-pre-line">{q.notes}</p>
          </section>
        )}

        {org?.pdf_footer && (
          <footer className="mt-8 border-t pt-4 text-center text-xs text-muted-foreground whitespace-pre-line">
            {org.pdf_footer}
          </footer>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={"flex items-center justify-between " + (strong ? "text-base font-semibold" : "")}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
