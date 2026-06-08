import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tenantInput = z.object({ tenantId: z.string().uuid() });

async function assertAdmin(supabase: any, tenantId: string, userId: string) {
  const { data } = await supabase
    .from("user_tenants")
    .select("role, is_owner")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || (data.role !== "admin" && !data.is_owner)) {
    throw new Error("Solo propietarios y administradores pueden gestionar usuarios");
  }
}

export const listTenantUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => tenantInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: members } = await supabase
      .from("user_tenants")
      .select(
        "id, user_id, tenant_id, role, is_active, is_owner, invited_at, last_active_at, created_at, profile:profiles(id, full_name, avatar_url)"
      )
      .eq("tenant_id", data.tenantId)
      .order("created_at");

    const { data: invitations } = await supabase
      .from("tenant_invitations")
      .select("id, email, role, expires_at, accepted_at, created_at, token")
      .eq("tenant_id", data.tenantId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });

    return { members: members ?? [], invitations: invitations ?? [] };
  });

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tenantId: z.string().uuid(),
        email: z.string().email().max(255),
        role: z.enum(["admin", "sales", "operations", "finance", "warehouse", "viewer"]),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, data.tenantId, userId);

    // license check
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan:plans(max_users)")
      .eq("tenant_id", data.tenantId)
      .maybeSingle();
    const { count } = await supabase
      .from("user_tenants")
      .select("user_id", { count: "exact", head: true })
      .eq("tenant_id", data.tenantId)
      .eq("is_active", true);
    const max = (sub?.plan as any)?.max_users;
    if (max != null && (count ?? 0) >= max) {
      throw new Error(`Has alcanzado el límite de usuarios de tu plan (${max}). Actualiza tu plan para invitar más.`);
    }

    const { data: inv, error } = await supabase
      .from("tenant_invitations")
      .insert({
        tenant_id: data.tenantId,
        email: data.email.toLowerCase(),
        role: data.role,
        invited_by: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return inv;
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ tenantId: z.string().uuid(), invitationId: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, data.tenantId, context.userId);
    const { error } = await context.supabase
      .from("tenant_invitations")
      .delete()
      .eq("id", data.invitationId)
      .eq("tenant_id", data.tenantId);
    if (error) throw error;
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tenantId: z.string().uuid(),
        userId: z.string().uuid(),
        role: z.enum(["admin", "sales", "operations", "finance", "warehouse", "viewer"]),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, data.tenantId, context.userId);
    const { error } = await context.supabase
      .from("user_tenants")
      .update({ role: data.role })
      .eq("tenant_id", data.tenantId)
      .eq("user_id", data.userId);
    if (error) throw error;
    return { ok: true };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tenantId: z.string().uuid(),
        userId: z.string().uuid(),
        isActive: z.boolean(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, data.tenantId, context.userId);
    const { error } = await context.supabase
      .from("user_tenants")
      .update({ is_active: data.isActive })
      .eq("tenant_id", data.tenantId)
      .eq("user_id", data.userId);
    if (error) throw error;
    return { ok: true };
  });

export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: z.string().min(10) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as any).email as string | undefined;

    const { data: inv } = await supabase
      .from("tenant_invitations")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (!inv) throw new Error("Invitación no válida");
    if (inv.accepted_at) throw new Error("Esta invitación ya fue aceptada");
    if (new Date(inv.expires_at) < new Date()) throw new Error("La invitación expiró");
    if (email && inv.email.toLowerCase() !== email.toLowerCase()) {
      throw new Error("Esta invitación es para otro correo");
    }

    // Insert membership (ignore if exists)
    const { error: e1 } = await supabase
      .from("user_tenants")
      .upsert(
        {
          tenant_id: inv.tenant_id,
          user_id: userId,
          role: inv.role,
          is_active: true,
          invited_at: inv.created_at,
        },
        { onConflict: "user_id,tenant_id" }
      );
    if (e1) throw e1;

    await supabase
      .from("tenant_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", inv.id);

    return { tenantId: inv.tenant_id };
  });
