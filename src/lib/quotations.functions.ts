/**
 * Server functions for the quotations module.
 * - generateQuotationPdf: build PDF (pdf-lib), upload to private storage, return signed URL.
 * - fetchPublicQuotation: token-based public viewer (no auth).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildQuotationPdf, type PdfBuildInput } from "./quotation-pdf.server";

export const generateQuotationPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ quotationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: q, error: qErr } = await supabase
      .from("quotations")
      .select("*")
      .eq("id", data.quotationId)
      .maybeSingle();
    if (qErr) throw new Error(qErr.message);
    if (!q) throw new Error("Cotización no encontrada");

    const { data: items, error: iErr } = await supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", q.id)
      .order("position", { ascending: true });
    if (iErr) throw new Error(iErr.message);

    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, fiscal_id, primary_color")
      .eq("id", q.tenant_id)
      .maybeSingle();

    const { data: orgSettings } = await supabase
      .from("organization_settings")
      .select("pdf_footer")
      .eq("tenant_id", q.tenant_id)
      .maybeSingle();

    const snap = (q.customer_snapshot ?? {}) as Record<string, string | null>;

    const input: PdfBuildInput = {
      tenant: {
        name: tenant?.name ?? "Empresa",
        fiscal_id: tenant?.fiscal_id ?? null,
        primary_color: tenant?.primary_color ?? null,
      },
      customer: snap,
      header: {
        folio: q.folio,
        status: q.status,
        issue_date: q.issue_date,
        valid_until: q.valid_until,
        currency: q.currency,
        payment_terms: q.payment_terms,
        delivery_terms: q.delivery_terms,
        notes: q.notes,
        subtotal: Number(q.subtotal),
        discount_pct: Number(q.discount_pct),
        discount_amount: Number(q.discount_amount),
        tax_amount: Number(q.tax_amount),
        total: Number(q.total),
      },
      items: (items ?? []).map((it) => ({
        position: it.position,
        name: it.name,
        sku: it.sku,
        unit: it.unit,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        discount_pct: Number(it.discount_pct),
        tax_rate: Number(it.tax_rate),
        total: Number(it.total),
      })),
      footer: orgSettings?.pdf_footer ?? null,
    };

    const bytes = await buildQuotationPdf(input);
    const path = `${q.tenant_id}/${q.id}/${Date.now()}.pdf`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("quotation-pdfs")
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (upErr) throw new Error(`No se pudo subir el PDF: ${upErr.message}`);

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("quotation-pdfs")
      .createSignedUrl(path, 60 * 60); // 1h
    if (signErr || !signed) throw new Error("No se pudo generar el enlace al PDF");

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: q.tenant_id,
      user_id: userId,
      action: "quotation.pdf_generated",
      entity_type: "quotation",
      entity_id: q.id,
      metadata: { folio: q.folio, path },
    });

    return { path, signedUrl: signed.signedUrl, folio: q.folio };
  });

// Public viewer (no auth) — used by /q/$token
export const fetchPublicQuotation = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ token: z.string().min(16).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const { data: tok } = await supabaseAdmin
      .from("quotation_public_tokens")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();

    if (!tok || tok.revoked_at) {
      return { ok: false as const, reason: "invalid" as const };
    }
    if (tok.expires_at && new Date(tok.expires_at).getTime() < Date.now()) {
      return { ok: false as const, reason: "expired" as const };
    }

    const [{ data: q }, { data: items }] = await Promise.all([
      supabaseAdmin.from("quotations").select("*").eq("id", tok.quotation_id).maybeSingle(),
      supabaseAdmin
        .from("quotation_items")
        .select("*")
        .eq("quotation_id", tok.quotation_id)
        .order("position", { ascending: true }),
    ]);

    if (!q) return { ok: false as const, reason: "invalid" as const };

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("name, fiscal_id, primary_color, logo_url")
      .eq("id", q.tenant_id)
      .maybeSingle();

    const { data: orgSettings } = await supabaseAdmin
      .from("organization_settings")
      .select("pdf_footer")
      .eq("tenant_id", q.tenant_id)
      .maybeSingle();

    // Track view (fire-and-forget; ignore failure)
    await supabaseAdmin
      .from("quotation_public_tokens")
      .update({
        view_count: (tok.view_count ?? 0) + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq("id", tok.id);

    return {
      ok: true as const,
      quotation: q,
      items: items ?? [],
      tenant: tenant ?? null,
      footer: orgSettings?.pdf_footer ?? null,
    };
  });

// Public PDF download — generates fresh PDF for a valid token
export const downloadPublicQuotationPdf = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(16).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const { data: tok } = await supabaseAdmin
      .from("quotation_public_tokens")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (!tok || tok.revoked_at) throw new Error("Token inválido");
    if (tok.expires_at && new Date(tok.expires_at).getTime() < Date.now()) {
      throw new Error("Token expirado");
    }

    const [{ data: q }, { data: items }] = await Promise.all([
      supabaseAdmin.from("quotations").select("*").eq("id", tok.quotation_id).maybeSingle(),
      supabaseAdmin
        .from("quotation_items")
        .select("*")
        .eq("quotation_id", tok.quotation_id)
        .order("position", { ascending: true }),
    ]);
    if (!q) throw new Error("Cotización no encontrada");

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("name, fiscal_id, primary_color")
      .eq("id", q.tenant_id)
      .maybeSingle();
    const { data: orgSettings } = await supabaseAdmin
      .from("organization_settings")
      .select("pdf_footer")
      .eq("tenant_id", q.tenant_id)
      .maybeSingle();

    const snap = (q.customer_snapshot ?? {}) as Record<string, string | null>;
    const bytes = await buildQuotationPdf({
      tenant: {
        name: tenant?.name ?? "Empresa",
        fiscal_id: tenant?.fiscal_id ?? null,
        primary_color: tenant?.primary_color ?? null,
      },
      customer: snap,
      header: {
        folio: q.folio,
        status: q.status,
        issue_date: q.issue_date,
        valid_until: q.valid_until,
        currency: q.currency,
        payment_terms: q.payment_terms,
        delivery_terms: q.delivery_terms,
        notes: q.notes,
        subtotal: Number(q.subtotal),
        discount_pct: Number(q.discount_pct),
        discount_amount: Number(q.discount_amount),
        tax_amount: Number(q.tax_amount),
        total: Number(q.total),
      },
      items: (items ?? []).map((it) => ({
        position: it.position,
        name: it.name,
        sku: it.sku,
        unit: it.unit,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        discount_pct: Number(it.discount_pct),
        tax_rate: Number(it.tax_rate),
        total: Number(it.total),
      })),
      footer: orgSettings?.pdf_footer ?? null,
    });

    const path = `${q.tenant_id}/${q.id}/public-${Date.now()}.pdf`;
    await supabaseAdmin.storage
      .from("quotation-pdfs")
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    const { data: signed } = await supabaseAdmin.storage
      .from("quotation-pdfs")
      .createSignedUrl(path, 60 * 10); // 10 min

    return { signedUrl: signed?.signedUrl ?? null, folio: q.folio };
  });
