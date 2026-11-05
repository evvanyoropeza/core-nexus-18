import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DISCOUNT_APPROVAL_THRESHOLD, type Quotation } from "@/lib/quotations";

interface Props {
  quotation: Quotation;
  maxDiscount: number;
  needsApproval: boolean;
  isAdmin: boolean;
  onChanged: () => void | Promise<void>;
}

export function DiscountApprovalBanner({ quotation: q, maxDiscount, needsApproval, isAdmin, onChanged }: Props) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const pct = `${maxDiscount.toFixed(2)}%`;

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(ok);
    setNote("");
    await onChanged();
  };

  const request = () =>
    run(() => supabase.rpc("request_discount_approval", { _quotation_id: q.id }), "Solicitud enviada al administrador");
  const decide = (approve: boolean) =>
    run(
      () => supabase.rpc("decide_discount_approval", { _quotation_id: q.id, _approve: approve, _note: note }),
      approve ? "Descuento aprobado" : "Descuento rechazado",
    );

  // Aprobado y vigente
  if (q.approval_status === "approved" && !needsApproval) {
    return (
      <Alert className="border-success/40 bg-success/5">
        <CheckCircle2 className="size-4 text-success" />
        <AlertTitle>Descuento autorizado ({Number(q.approved_discount_pct ?? 0).toFixed(2)}%)</AlertTitle>
        <AlertDescription>
          {q.approval_note ? `Nota: ${q.approval_note}` : "La cotización puede enviarse y convertirse en orden."}
        </AlertDescription>
      </Alert>
    );
  }

  if (!needsApproval) return null;

  const pending = q.approval_status === "pending";
  const rejected = q.approval_status === "rejected";

  return (
    <Alert className={rejected ? "border-destructive/40 bg-destructive/5" : "border-warning/50 bg-warning/10"}>
      {rejected ? <XCircle className="size-4 text-destructive" /> : pending ? <Clock className="size-4" /> : <AlertTriangle className="size-4" />}
      <AlertTitle>
        {rejected
          ? "Descuento rechazado"
          : pending
            ? `Pendiente de aprobación · descuento de ${pct}`
            : `Descuento de ${pct} requiere autorización`}
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          {rejected
            ? q.approval_note
              ? `Motivo: ${q.approval_note}. Ajusta el descuento o vuelve a solicitar autorización.`
              : "Ajusta el descuento o vuelve a solicitar autorización."
            : `Los descuentos mayores a ${DISCOUNT_APPROVAL_THRESHOLD}% necesitan el visto bueno de un administrador antes de enviar, compartir, generar PDF o convertir en orden.`}
        </p>

        {isAdmin ? (
          <div className="space-y-2">
            <Textarea rows={2} placeholder="Comentario para el vendedor (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => decide(true)}>
                <CheckCircle2 className="mr-2 size-4" /> Aprobar descuento
              </Button>
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => decide(false)}>
                <XCircle className="mr-2 size-4" /> Rechazar
              </Button>
            </div>
          </div>
        ) : (
          !pending && (
            <Button size="sm" disabled={busy} onClick={request}>
              Solicitar autorización
            </Button>
          )
        )}
      </AlertDescription>
    </Alert>
  );
}
