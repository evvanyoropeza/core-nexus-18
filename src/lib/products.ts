import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
export type ProductCategory = Database["public"]["Tables"]["product_categories"]["Row"];
export type PriceTier = Database["public"]["Tables"]["product_price_tiers"]["Row"];
export type ProductType = Database["public"]["Enums"]["product_type"];

export const UNITS = ["pza", "kg", "g", "lt", "ml", "m", "cm", "m2", "m3", "hr", "servicio", "caja", "paquete"] as const;

export const productSchema = z.object({
  sku: z.string().trim().min(1, "SKU requerido").max(60).regex(/^[A-Za-z0-9._\-/]+$/, "Solo letras, números, ._-/"),
  name: z.string().trim().min(1, "Nombre requerido").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  type: z.enum(["product", "service"]).default("product"),
  unit: z.string().trim().min(1).max(20).default("pza"),
  category_id: z.string().uuid().nullable().optional(),
  list_price: z.coerce.number().min(0).default(0),
  cost: z.coerce.number().min(0).default(0),
  tax_rate: z.coerce.number().min(0).max(100).default(16),
  stock_min: z.coerce.number().min(0).default(0),
  stock_current: z.coerce.number().min(0).default(0),
  image_url: z.string().trim().url("URL inválida").max(500).optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  is_active: z.boolean().default(true),
});

export type ProductForm = z.infer<typeof productSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  parent_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().default(true),
});
export type CategoryForm = z.infer<typeof categorySchema>;

export const priceTierSchema = z.object({
  min_quantity: z.coerce.number().min(0.0001, "Cantidad inválida"),
  price: z.coerce.number().min(0),
});
export type PriceTierForm = z.infer<typeof priceTierSchema>;

export function nullifyEmpty<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = v === "" ? null : v;
  return out as T;
}

export function marginPct(price: number, cost: number): number | null {
  if (!price || price <= 0) return null;
  return ((price - cost) / price) * 100;
}

// --- CSV ---
const CSV_HEADERS = [
  "sku","name","description","type","unit","list_price","cost","tax_rate",
  "stock_min","stock_current","tags","is_active","notes",
] as const;

export function toCSV(rows: Product[]): string {
  const escape = (v: unknown) => {
    const s = v == null ? "" : Array.isArray(v) ? v.join("|") : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [CSV_HEADERS.join(",")];
  for (const r of rows) {
    lines.push(CSV_HEADERS.map((h) => escape((r as unknown as Record<string, unknown>)[h])).join(","));
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

export async function fetchProducts(tenantId: string, opts: {
  search?: string; tag?: string | null; categoryId?: string | null;
  type?: ProductType | null; activeOnly?: boolean; lowStock?: boolean;
}) {
  let q = supabase
    .from("products")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true })
    .limit(1000);
  if (opts.activeOnly) q = q.eq("is_active", true);
  if (opts.tag) q = q.contains("tags", [opts.tag]);
  if (opts.categoryId) q = q.eq("category_id", opts.categoryId);
  if (opts.type) q = q.eq("type", opts.type);
  if (opts.search?.trim()) {
    const s = `%${opts.search.trim()}%`;
    q = q.or(`name.ilike.${s},sku.ilike.${s},description.ilike.${s}`);
  }
  const { data, error } = await q;
  if (error) throw error;
  let rows = data ?? [];
  if (opts.lowStock) {
    rows = rows.filter((p) => p.type === "product" && Number(p.stock_current) <= Number(p.stock_min));
  }
  return rows;
}

export async function fetchCategories(tenantId: string) {
  const { data, error } = await supabase
    .from("product_categories")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPriceTiers(productId: string) {
  const { data, error } = await supabase
    .from("product_price_tiers")
    .select("*")
    .eq("product_id", productId)
    .order("min_quantity", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
