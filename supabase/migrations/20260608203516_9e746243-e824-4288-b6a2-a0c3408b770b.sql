
-- =========================================================
-- 1. ENUM extensions
-- =========================================================
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'warehouse';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('trial','active','suspended','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- 2. PLANS (catálogo global)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'MXN',
  max_users integer,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans_read_all" ON public.plans;
CREATE POLICY "plans_read_all" ON public.plans
  FOR SELECT TO authenticated USING (is_active = true);

CREATE TRIGGER plans_set_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed planes
INSERT INTO public.plans (code, name, description, price_monthly, max_users, features, limits, sort_order) VALUES
  ('basic', 'Básico', 'Para empezar a operar con clientes y cotizaciones', 499, 2,
   '["customers","quotations"]'::jsonb,
   '{"max_customers":100,"max_quotations_month":50}'::jsonb, 1),
  ('commercial', 'Comercial', 'Ciclo comercial completo con pipeline y órdenes', 1499, 10,
   '["customers","quotations","orders","pipeline","reports"]'::jsonb,
   '{"max_customers":1000,"max_quotations_month":500}'::jsonb, 2),
  ('operations', 'Operaciones', 'Suma inventario y analíticas avanzadas', 2999, 25,
   '["customers","quotations","orders","pipeline","reports","inventory","analytics"]'::jsonb,
   '{"max_customers":5000,"max_quotations_month":2000}'::jsonb, 3),
  ('enterprise', 'Enterprise', 'Sin límites, soporte premium', 6999, NULL,
   '["customers","quotations","orders","pipeline","reports","inventory","analytics"]'::jsonb,
   '{}'::jsonb, 4)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly, max_users = EXCLUDED.max_users,
  features = EXCLUDED.features, limits = EXCLUDED.limits, sort_order = EXCLUDED.sort_order;

-- =========================================================
-- 3. SUBSCRIPTIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  status public.subscription_status NOT NULL DEFAULT 'trial',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  trial_end_date date,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subs_select_members" ON public.subscriptions;
CREATE POLICY "subs_select_members" ON public.subscriptions
  FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "subs_manage_admin" ON public.subscriptions;
CREATE POLICY "subs_manage_admin" ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role]));

CREATE TRIGGER subs_set_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 4. TENANT FEATURE OVERRIDES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.tenant_feature_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_code text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  reason text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, feature_code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_feature_overrides TO authenticated;
GRANT ALL ON public.tenant_feature_overrides TO service_role;
ALTER TABLE public.tenant_feature_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tfo_select_members" ON public.tenant_feature_overrides
  FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), tenant_id));
CREATE POLICY "tfo_manage_admin" ON public.tenant_feature_overrides
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role]));

CREATE TRIGGER tfo_set_updated_at BEFORE UPDATE ON public.tenant_feature_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 5. INVITATIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.tenant_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'viewer',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  invited_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tenant_invitations_email_idx ON public.tenant_invitations(lower(email));
CREATE INDEX IF NOT EXISTS tenant_invitations_token_idx ON public.tenant_invitations(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_invitations TO authenticated;
GRANT ALL ON public.tenant_invitations TO service_role;
ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_select_admin" ON public.tenant_invitations
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role]));
CREATE POLICY "inv_manage_admin" ON public.tenant_invitations
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role]));

CREATE TRIGGER inv_set_updated_at BEFORE UPDATE ON public.tenant_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 6. USER_TENANTS extensions
-- =========================================================
ALTER TABLE public.user_tenants
  ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- =========================================================
-- 7. CORE FUNCTIONS
-- =========================================================
CREATE OR REPLACE FUNCTION public.current_subscription(_tenant_id uuid)
RETURNS public.subscriptions
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.subscriptions WHERE tenant_id = _tenant_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.tenant_has_feature(_tenant_id uuid, _feature text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub public.subscriptions%ROWTYPE;
  v_plan_features jsonb;
  v_override boolean;
  v_active boolean;
BEGIN
  SELECT * INTO v_sub FROM public.subscriptions WHERE tenant_id = _tenant_id LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;

  -- estado activo
  v_active := v_sub.status IN ('trial','active');
  IF v_sub.status = 'trial' AND v_sub.trial_end_date IS NOT NULL AND v_sub.trial_end_date < CURRENT_DATE THEN
    v_active := false;
  END IF;
  IF NOT v_active THEN RETURN false; END IF;

  -- override explícito
  SELECT enabled INTO v_override
    FROM public.tenant_feature_overrides
   WHERE tenant_id = _tenant_id AND feature_code = _feature LIMIT 1;
  IF v_override IS NOT NULL THEN RETURN v_override; END IF;

  -- features del plan
  SELECT features INTO v_plan_features FROM public.plans WHERE id = v_sub.plan_id;
  RETURN v_plan_features ? _feature;
END; $$;

GRANT EXECUTE ON FUNCTION public.tenant_has_feature(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_subscription(uuid) TO authenticated;

-- auto-suspend on read
CREATE OR REPLACE FUNCTION public.auto_suspend_expired_trials()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.subscriptions
     SET status = 'suspended', updated_at = now()
   WHERE status = 'trial'
     AND trial_end_date IS NOT NULL
     AND trial_end_date < CURRENT_DATE;
$$;
GRANT EXECUTE ON FUNCTION public.auto_suspend_expired_trials() TO authenticated;

-- =========================================================
-- 8. FEATURE GATE TRIGGERS on module tables
--    Bloquean INSERT/UPDATE si el módulo no está contratado.
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_feature_gate()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_feature text := TG_ARGV[0];
  v_tenant uuid := NEW.tenant_id;
BEGIN
  IF NOT public.tenant_has_feature(v_tenant, v_feature) THEN
    RAISE EXCEPTION 'Módulo % no disponible en tu plan actual', v_feature
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;

-- helper to safely create per-table gate
DO $$
DECLARE
  r record;
  pairs text[][] := ARRAY[
    ARRAY['customers','customers'],
    ARRAY['quotations','quotations'],
    ARRAY['quotation_items','quotations'],
    ARRAY['sales_orders','orders'],
    ARRAY['sales_order_items','orders'],
    ARRAY['products','customers'],         -- productos siempre disponibles si hay customers
    ARRAY['stock_movements','inventory']
  ];
  pair text[];
  trig_name text;
BEGIN
  FOREACH pair SLICE 1 IN ARRAY pairs LOOP
    trig_name := 'trg_feature_gate_' || pair[1];
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trig_name, pair[1]);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.enforce_feature_gate(%L)',
      trig_name, pair[1], pair[2]
    );
  END LOOP;
END $$;

-- =========================================================
-- 9. AUDIT TRIGGERS
-- =========================================================
CREATE OR REPLACE FUNCTION public.audit_subscription_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs(tenant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (
    NEW.tenant_id, auth.uid(),
    CASE WHEN TG_OP = 'INSERT' THEN 'subscription.created' ELSE 'subscription.changed' END,
    'subscription', NEW.id::text,
    jsonb_build_object(
      'old', CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
      'new', to_jsonb(NEW)
    )
  );
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_audit_subscription ON public.subscriptions;
CREATE TRIGGER trg_audit_subscription
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.audit_subscription_change();

CREATE OR REPLACE FUNCTION public.audit_user_tenant_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN v_action := 'user.added';
  ELSIF OLD.role IS DISTINCT FROM NEW.role THEN v_action := 'user.role_changed';
  ELSIF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
    v_action := CASE WHEN NEW.is_active THEN 'user.activated' ELSE 'user.deactivated' END;
  ELSE RETURN NEW;
  END IF;
  INSERT INTO public.audit_logs(tenant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (NEW.tenant_id, auth.uid(), v_action, 'user_tenant', NEW.user_id::text,
    jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_audit_user_tenant ON public.user_tenants;
CREATE TRIGGER trg_audit_user_tenant
  AFTER INSERT OR UPDATE ON public.user_tenants
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_tenant_change();

CREATE OR REPLACE FUNCTION public.audit_feature_override()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs(tenant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (NEW.tenant_id, auth.uid(), 'feature.toggled', 'feature_override', NEW.id::text,
    jsonb_build_object('feature', NEW.feature_code, 'enabled', NEW.enabled, 'reason', NEW.reason));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_audit_feature_override ON public.tenant_feature_overrides;
CREATE TRIGGER trg_audit_feature_override
  AFTER INSERT OR UPDATE ON public.tenant_feature_overrides
  FOR EACH ROW EXECUTE FUNCTION public.audit_feature_override();

-- =========================================================
-- 10. handle_new_user — trial 30 días + owner
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_tenant_id UUID;
  org_name TEXT;
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
  v_plan_id uuid;
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

  INSERT INTO public.tenants (name, slug) VALUES (org_name, final_slug)
  RETURNING id INTO new_tenant_id;

  INSERT INTO public.organization_settings (tenant_id) VALUES (new_tenant_id);

  INSERT INTO public.profiles (id, full_name, current_tenant_id)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    new_tenant_id);

  INSERT INTO public.user_tenants (user_id, tenant_id, role, is_owner)
  VALUES (NEW.id, new_tenant_id, 'admin', true);

  -- Suscripción trial Comercial 30 días
  SELECT id INTO v_plan_id FROM public.plans WHERE code = 'commercial' LIMIT 1;
  IF v_plan_id IS NOT NULL THEN
    INSERT INTO public.subscriptions(tenant_id, plan_id, status, start_date, trial_end_date)
    VALUES (new_tenant_id, v_plan_id, 'trial', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days');
  END IF;

  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (new_tenant_id, NEW.id, 'user.signup', 'user', NEW.id::text,
          jsonb_build_object('email', NEW.email, 'organization', org_name));

  RETURN NEW;
END; $$;

-- Marcar como owner al admin existente de cada tenant (retro)
UPDATE public.user_tenants ut SET is_owner = true
  WHERE role = 'admin' AND NOT EXISTS (
    SELECT 1 FROM public.user_tenants ut2
     WHERE ut2.tenant_id = ut.tenant_id AND ut2.is_owner = true
  );

-- Backfill: crear suscripción trial para tenants existentes sin suscripción
INSERT INTO public.subscriptions(tenant_id, plan_id, status, start_date, trial_end_date)
SELECT t.id, p.id, 'trial', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days'
  FROM public.tenants t
  CROSS JOIN public.plans p
 WHERE p.code = 'commercial'
   AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.tenant_id = t.id);
