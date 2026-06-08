import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tenantInput = z.object({ tenantId: z.string().uuid() });

export const getSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => tenantInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // auto-suspend expired trials
    await supabase.rpc("auto_suspend_expired_trials");

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*, plan:plans(*)")
      .eq("tenant_id", data.tenantId)
      .maybeSingle();

    const { data: overrides } = await supabase
      .from("tenant_feature_overrides")
      .select("feature_code, enabled")
      .eq("tenant_id", data.tenantId);

    const planFeatures: string[] = (sub?.plan?.features as string[] | undefined) ?? [];
    const overrideMap = new Map((overrides ?? []).map((o) => [o.feature_code, o.enabled]));
    const allFeatures = new Set([...planFeatures, ...overrideMap.keys()]);
    const effective: string[] = [];
    for (const f of allFeatures) {
      const ov = overrideMap.get(f);
      if (ov === false) continue;
      if (ov === true || planFeatures.includes(f)) effective.push(f);
    }

    // license usage
    const { count: activeUsers } = await supabase
      .from("user_tenants")
      .select("user_id", { count: "exact", head: true })
      .eq("tenant_id", data.tenantId)
      .eq("is_active", true);

    const isActive = sub
      ? sub.status === "active" ||
        (sub.status === "trial" &&
          (!sub.trial_end_date || new Date(sub.trial_end_date) >= new Date()))
      : false;

    const trialDaysLeft = sub?.trial_end_date
      ? Math.max(
          0,
          Math.ceil(
            (new Date(sub.trial_end_date).getTime() - Date.now()) / 86400000
          )
        )
      : null;

    return {
      subscription: sub,
      effectiveFeatures: effective,
      planFeatures,
      overrides: overrides ?? [],
      usage: {
        activeUsers: activeUsers ?? 0,
        maxUsers: sub?.plan?.max_users ?? null,
      },
      isActive,
      trialDaysLeft,
    };
  });

export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    return data ?? [];
  });

export const changePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ tenantId: z.string().uuid(), planCode: z.string().min(1) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: membership } = await supabase
      .from("user_tenants")
      .select("role, is_owner")
      .eq("tenant_id", data.tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership || (membership.role !== "admin" && !membership.is_owner)) {
      throw new Error("Solo propietarios y administradores pueden cambiar el plan");
    }

    const { data: plan } = await supabase
      .from("plans")
      .select("id")
      .eq("code", data.planCode)
      .maybeSingle();
    if (!plan) throw new Error("Plan no encontrado");

    const { error } = await supabase
      .from("subscriptions")
      .update({
        plan_id: plan.id,
        status: "active",
        start_date: new Date().toISOString().slice(0, 10),
        trial_end_date: null,
        cancelled_at: null,
      })
      .eq("tenant_id", data.tenantId);
    if (error) throw error;
    return { ok: true };
  });

export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => tenantInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("subscriptions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("tenant_id", data.tenantId);
    if (error) throw error;
    return { ok: true };
  });

export const toggleFeatureOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tenantId: z.string().uuid(),
        feature: z.string().min(1),
        enabled: z.boolean(),
        reason: z.string().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tenant_feature_overrides")
      .upsert(
        {
          tenant_id: data.tenantId,
          feature_code: data.feature,
          enabled: data.enabled,
          reason: data.reason ?? null,
          created_by: context.userId,
        },
        { onConflict: "tenant_id,feature_code" }
      );
    if (error) throw error;
    return { ok: true };
  });
