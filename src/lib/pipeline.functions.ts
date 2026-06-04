import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PipelineCard = {
  id: string;
  folio: string;
  status: string;
  total: number;
  customer_name: string;
  created_at: string;
  valid_until: string | null;
};

export const getPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }): Promise<PipelineCard[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("quotations")
      .select("id, folio, status, total, customer_snapshot, created_at, valid_until")
      .eq("tenant_id", data.tenantId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (rows ?? []).map((r) => {
      const snap = (r.customer_snapshot ?? {}) as { name?: string };
      return {
        id: r.id as string,
        folio: r.folio as string,
        status: r.status as string,
        total: Number(r.total ?? 0),
        customer_name: snap.name ?? "—",
        created_at: r.created_at as string,
        valid_until: r.valid_until as string | null,
      };
    });
  });

export const setQuotationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { quotationId: string; status: "draft" | "sent" | "accepted" | "rejected" | "expired" }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const now = new Date().toISOString();
    const patch: {
      status: typeof data.status;
      updated_at: string;
      sent_at?: string;
      decided_at?: string;
    } = { status: data.status, updated_at: now };
    if (data.status === "sent") patch.sent_at = now;
    if (data.status === "accepted" || data.status === "rejected") patch.decided_at = now;
    const { error } = await supabase.from("quotations").update(patch).eq("id", data.quotationId);
    if (error) throw error;
    return { ok: true };
  });
