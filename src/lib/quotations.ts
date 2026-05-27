import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Quotation = Database["public"]["Tables"]["quotations"]["Row"];
export type QuotationInsert = Database["public"]["Tables"]["quotations"]["Insert"];
export type QuotationItem = Database["public"]["Tables"]["quotation_items"]["Row"];
export type QuotationItemInsert = Database["public"]["Tables"]["quotation_items"]["Insert"];
export type QuotationStatus = Database["public"]["Enums"]["quotation_status"];

export const STATUS_LABEL: Record<QuotationStatus, string> = {
  draft: "Borrador",
  sent: "Enviada",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Expirada",
  converted: "Convertida",
};

export const STATUS_VARIANT: Record<QuotationStatus, "secondary" | "default" | "destructive" | "outline"> = {
  draft: "secondary",
  sent: "default",
  accepted: "default",
  rejected: "destructive",
  expired: "outline",
  converted: "default",
};

export const quotationHeaderSchema = z.object({
  customer_id: z.string().uuid("Selecciona un cliente"),
  issue_date: z.string().min(1, "Requerido"),
  valid_until: z.string().optional().or(z.literal("")),
  currency: z.string().min(3).max(3).default("MXN"),
  payment_terms: z.string().max(200).optional().or(z.literal("")),
  delivery_terms: z.string().max(200).optional().or(z.literal("")),
  discount_pct: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().max(4000).optional().or(z.literal("")),
  internal_notes: z.string().max(4000).optional().or(z.literal("")),
});
export type QuotationHeaderForm = z.infer<typeof quotationHeaderSchema>;

export const quotationItemSchema = z.object({
  product_id: z.string().uuid().nullable().optional(),
  sku: z.string().max(60).optional().or(z.literal("")),
  name: z.string().trim().min(1, "Requerido").max(200),
  description: z.string().max(1000).optional().or(z.literal("")),
  unit: z.string().min(1).max(20).default("pza"),
  quantity: z.coerce.number().positive("> 0"),
  unit_price: z.coerce.number().min(0),
  discount_pct: z.coerce.number().min(0).max(100).default(0),
  tax_rate: z.coerce.number().min(0).max(100).default(16),
});
export type QuotationItemForm = z.infer<typeof quotationItemSchema>;

export function computeLine(i: { quantity: number; unit_price: number; discount_pct: number; tax_rate: number }) {
  const gross = (i.quantity || 0) * (i.unit_price || 0);
  const net = gross * (1 - (i.discount_pct || 0) / 100);
  const tax = net * ((i.tax_rate || 0) / 100);
  return {
    subtotal: round2(net),
    tax_amount: round2(tax),
    total: round2(net + tax),
  };
}

export function computeTotals(items: Array<{ subtotal: number; tax_amount: number }>, discountPct = 0) {
  const subtotal = round2(items.reduce((s, i) => s + Number(i.subtotal || 0), 0));
  const tax = round2(items.reduce((s, i) => s + Number(i.tax_amount || 0), 0));
  const discount = round2((subtotal * (discountPct || 0)) / 100);
  const total = round2(subtotal - discount + tax);
  return { subtotal, tax, discount, total };
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatMoney(n: number | string | null | undefined, currency = "MXN") {
  const v = typeof n === "string" ? Number(n) : n ?? 0;
  return new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 2 }).format(v);
}

export async function fetchQuotations(tenantId: string, opts: {
  search?: string; status?: QuotationStatus | null; customerId?: string | null;
}) {
  let q = supabase
    .from("quotations")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.customerId) q = q.eq("customer_id", opts.customerId);
  if (opts.search?.trim()) {
    const s = `%${opts.search.trim()}%`;
    q = q.or(`folio.ilike.${s},notes.ilike.${s}`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchQuotation(id: string) {
  const { data, error } = await supabase.from("quotations").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchQuotationItems(quotationId: string) {
  const { data, error } = await supabase
    .from("quotation_items")
    .select("*")
    .eq("quotation_id", quotationId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function generateFolio(tenantId: string): Promise<string> {
  const { data, error } = await supabase.rpc("generate_quotation_folio", { _tenant_id: tenantId });
  if (error) throw error;
  return data as string;
}
