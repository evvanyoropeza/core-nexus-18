
-- =====================================================================
-- ENUMS
-- =====================================================================
CREATE TYPE public.app_role AS ENUM ('superadmin', 'admin', 'sales', 'operations', 'finance', 'viewer');

-- =====================================================================
-- TENANTS
-- =====================================================================
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#635bff',
  fiscal_id TEXT,
  fiscal_country TEXT DEFAULT 'MX',
  currency TEXT NOT NULL DEFAULT 'MXN',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- PROFILES
-- =====================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  current_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- USER_TENANTS (membership + role)
-- =====================================================================
CREATE TABLE public.user_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);
CREATE INDEX idx_user_tenants_user ON public.user_tenants(user_id);
CREATE INDEX idx_user_tenants_tenant ON public.user_tenants(tenant_id);
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- ORGANIZATION SETTINGS
-- =====================================================================
CREATE TABLE public.organization_settings (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 16.00,
  currency TEXT NOT NULL DEFAULT 'MXN',
  payment_terms TEXT DEFAULT '30 días',
  folio_prefix TEXT NOT NULL DEFAULT 'COT',
  folio_next INTEGER NOT NULL DEFAULT 1,
  pdf_footer TEXT,
  branding JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- AUDIT LOGS
-- =====================================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_tenant_created ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- SECURITY DEFINER FUNCTIONS (avoid RLS recursion)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.is_member_of(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_tenants
    WHERE user_id = _user_id AND tenant_id = _tenant_id AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _tenant_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_tenants
    WHERE user_id = _user_id AND tenant_id = _tenant_id AND role = _role AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _tenant_id UUID, _roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_tenants
    WHERE user_id = _user_id AND tenant_id = _tenant_id AND role = ANY(_roles) AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

-- =====================================================================
-- TIMESTAMP TRIGGERS
-- =====================================================================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_org_settings_updated BEFORE UPDATE ON public.organization_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =====================================================================
-- SIGNUP TRIGGER: create profile + tenant + admin membership
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id UUID;
  org_name TEXT;
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  org_name := COALESCE(NEW.raw_user_meta_data->>'organization_name', 'Mi Empresa');
  base_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN base_slug := 'empresa'; END IF;
  final_slug := base_slug;

  WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter::text;
  END LOOP;

  INSERT INTO public.tenants (name, slug)
  VALUES (org_name, final_slug)
  RETURNING id INTO new_tenant_id;

  INSERT INTO public.organization_settings (tenant_id) VALUES (new_tenant_id);

  INSERT INTO public.profiles (id, full_name, current_tenant_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    new_tenant_id
  );

  INSERT INTO public.user_tenants (user_id, tenant_id, role)
  VALUES (NEW.id, new_tenant_id, 'admin');

  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (new_tenant_id, NEW.id, 'user.signup', 'user', NEW.id::text,
          jsonb_build_object('email', NEW.email, 'organization', org_name));

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- RLS POLICIES
-- =====================================================================

-- TENANTS: members can read; admins can update
CREATE POLICY "tenants_select_member" ON public.tenants FOR SELECT
  USING (public.is_member_of(auth.uid(), id));
CREATE POLICY "tenants_update_admin" ON public.tenants FOR UPDATE
  USING (public.has_role(auth.uid(), id, 'admin'))
  WITH CHECK (public.has_role(auth.uid(), id, 'admin'));

-- PROFILES: user can manage own profile only
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT
  USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- USER_TENANTS: user sees own memberships; admins see all memberships of their tenant
CREATE POLICY "user_tenants_select_own" ON public.user_tenants FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), tenant_id, 'admin'));
CREATE POLICY "user_tenants_insert_admin" ON public.user_tenants FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), tenant_id, 'admin'));
CREATE POLICY "user_tenants_update_admin" ON public.user_tenants FOR UPDATE
  USING (public.has_role(auth.uid(), tenant_id, 'admin'));
CREATE POLICY "user_tenants_delete_admin" ON public.user_tenants FOR DELETE
  USING (public.has_role(auth.uid(), tenant_id, 'admin'));

-- ORGANIZATION SETTINGS
CREATE POLICY "org_settings_select_member" ON public.organization_settings FOR SELECT
  USING (public.is_member_of(auth.uid(), tenant_id));
CREATE POLICY "org_settings_update_admin" ON public.organization_settings FOR UPDATE
  USING (public.has_role(auth.uid(), tenant_id, 'admin'))
  WITH CHECK (public.has_role(auth.uid(), tenant_id, 'admin'));

-- AUDIT LOGS: members can read their tenant; insert via authenticated users for their tenants; no update/delete
CREATE POLICY "audit_logs_select_member" ON public.audit_logs FOR SELECT
  USING (public.is_member_of(auth.uid(), tenant_id));
CREATE POLICY "audit_logs_insert_member" ON public.audit_logs FOR INSERT
  WITH CHECK (public.is_member_of(auth.uid(), tenant_id) AND user_id = auth.uid());
