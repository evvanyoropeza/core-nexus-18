import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "superadmin" | "admin" | "sales" | "operations" | "finance" | "viewer";

export interface TenantMembership {
  tenant_id: string;
  role: AppRole;
  tenant: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    primary_color: string | null;
  };
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  current_tenant_id: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  memberships: TenantMembership[];
  currentTenant: TenantMembership | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  hasRole: (role: AppRole | AppRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (uid: string) => {
    const [{ data: prof }, { data: mems }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase
        .from("user_tenants")
        .select("tenant_id, role, tenant:tenants(id, name, slug, logo_url, primary_color)")
        .eq("user_id", uid)
        .eq("is_active", true),
    ]);
    setProfile(prof as Profile | null);
    setMemberships((mems ?? []) as unknown as TenantMembership[]);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      if (sess?.user) {
        setTimeout(() => void loadUserData(sess.user.id), 0);
      } else {
        setProfile(null);
        setMemberships([]);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadUserData(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const currentTenant =
    memberships.find((m) => m.tenant_id === profile?.current_tenant_id) ?? memberships[0] ?? null;

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    memberships,
    currentTenant,
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refresh: async () => {
      if (session?.user) await loadUserData(session.user.id);
    },
    switchTenant: async (tenantId) => {
      if (!session?.user) return;
      await supabase.from("profiles").update({ current_tenant_id: tenantId }).eq("id", session.user.id);
      await loadUserData(session.user.id);
    },
    hasRole: (role) => {
      if (!currentTenant) return false;
      const roles = Array.isArray(role) ? role : [role];
      return roles.includes(currentTenant.role);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export async function logAudit(input: {
  tenantId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("audit_logs").insert({
    tenant_id: input.tenantId,
    user_id: user.id,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  });
}
