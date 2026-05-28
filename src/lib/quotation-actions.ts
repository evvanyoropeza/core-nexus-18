/**
 * Client-side helpers for quotation extended actions:
 * duplicate, version snapshots and public sharing tokens.
 */
import { supabase } from "@/integrations/supabase/client";

export interface QuotationVersion {
  id: string;
  quotation_id: string;
  version_number: number;
  reason: string | null;
  snapshot: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface QuotationPublicToken {
  id: string;
  quotation_id: string;
  token: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  created_at: string;
}

export async function duplicateQuotation(quotationId: string): Promise<string> {
  const { data, error } = await supabase.rpc("duplicate_quotation", {
    _quotation_id: quotationId,
  });
  if (error) throw error;
  return data as string;
}

export async function snapshotQuotationVersion(
  quotationId: string,
  reason?: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("snapshot_quotation_version", {
    _quotation_id: quotationId,
    _reason: reason ?? undefined,
  });

  return data as number;
}

export async function listQuotationVersions(quotationId: string): Promise<QuotationVersion[]> {
  const { data, error } = await supabase
    .from("quotation_versions")
    .select("*")
    .eq("quotation_id", quotationId)
    .order("version_number", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as QuotationVersion[];
}

function randomToken(): string {
  // 32 bytes -> base64url ≈ 43 chars
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createPublicToken(
  tenantId: string,
  quotationId: string,
  daysValid: number | null = 30,
): Promise<QuotationPublicToken> {
  const token = randomToken();
  const expires_at = daysValid
    ? new Date(Date.now() + daysValid * 86_400_000).toISOString()
    : null;
  const { data, error } = await supabase
    .from("quotation_public_tokens")
    .insert({
      tenant_id: tenantId,
      quotation_id: quotationId,
      token,
      expires_at,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as QuotationPublicToken;
}

export async function revokePublicToken(tokenId: string): Promise<void> {
  const { error } = await supabase
    .from("quotation_public_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId);
  if (error) throw error;
}

export async function listPublicTokens(quotationId: string): Promise<QuotationPublicToken[]> {
  const { data, error } = await supabase
    .from("quotation_public_tokens")
    .select("*")
    .eq("quotation_id", quotationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as QuotationPublicToken[];
}

export function publicQuotationUrl(token: string): string {
  if (typeof window === "undefined") return `/q/${token}`;
  return `${window.location.origin}/q/${token}`;
}
