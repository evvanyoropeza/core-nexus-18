import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type CustomerInsert = Database["public"]["Tables"]["customers"]["Insert"];
export type CustomerContact = Database["public"]["Tables"]["customer_contacts"]["Row"];
export type CustomerNote = Database["public"]["Tables"]["customer_notes"]["Row"];

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(200),
  legal_name: z.string().trim().max(200).optional().or(z.literal("")),
  tax_id: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email("Email inválido").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().max(255).optional().or(z.literal("")),
  address_line1: z.string().trim().max(200).optional().or(z.literal("")),
  address_line2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  country: z.string().trim().max(2).default("MX"),
  postal_code: z.string().trim().max(20).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  credit_limit: z.coerce.number().min(0).default(0),
  credit_days: z.coerce.number().int().min(0).max(365).default(0),
  is_active: z.boolean().default(true),
});

export type CustomerForm = z.infer<typeof customerSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(120),
  position: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("Email inválido").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  mobile: z.string().trim().max(40).optional().or(z.literal("")),
  is_primary: z.boolean().default(false),
});

export type ContactForm = z.infer<typeof contactSchema>;

export function nullifyEmpty<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v === "" ? null : v;
  }
  return out as T;
}

// --- CSV utilities ---

export function toCSV(rows: Customer[]): string {
  const headers = [
    "name","legal_name","tax_id","email","phone","website",
    "address_line1","city","state","country","postal_code",
    "credit_limit","credit_days","tags","is_active","notes",
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : Array.isArray(v) ? v.join("|") : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => escape((r as unknown as Record<string, unknown>)[h])).join(","));
  }
  return lines.join("\n");
}

export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQ = false; }
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field); field = "";
        if (cur.some((x) => x !== "")) rows.push(cur);
        cur = [];
      } else field += c;
    }
  }
  if (field !== "" || cur.length) { cur.push(field); rows.push(cur); }
  if (!rows.length) return [];
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

export function downloadFile(filename: string, content: string, mime = "text/csv") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function fetchCustomers(tenantId: string, opts: {
  search?: string; tag?: string | null; activeOnly?: boolean;
}) {
  let q = supabase
    .from("customers")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true })
    .limit(500);
  if (opts.activeOnly) q = q.eq("is_active", true);
  if (opts.tag) q = q.contains("tags", [opts.tag]);
  if (opts.search?.trim()) {
    const s = `%${opts.search.trim()}%`;
    q = q.or(`name.ilike.${s},legal_name.ilike.${s},email.ilike.${s},tax_id.ilike.${s}`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
