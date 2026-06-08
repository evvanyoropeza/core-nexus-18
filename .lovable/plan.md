
# Arquitectura SaaS Comercial para Core Nexus

Extiende el modelo multi-tenant actual (tenants, user_tenants, audit_logs) con capa de **planes, suscripciones, feature flags y gestión de usuarios** sin romper datos existentes.

---

## 1. Base de datos (migración SQL única)

### Tablas nuevas

**`plans`** (catálogo global, lectura pública para usuarios autenticados)
- `code` (`basic` | `commercial` | `operations` | `enterprise`) único
- `name`, `description`, `price_monthly`, `currency`
- `max_users` (int, null = ilimitado)
- `features` jsonb — array de módulos: `["customers","quotations","orders","inventory","reports","analytics","pipeline"]`
- `limits` jsonb — `{ max_customers, max_products, max_quotations_month, ... }`
- `is_active` bool

Seed inicial:
- **Básico**: 2 usuarios · customers, quotations
- **Comercial**: 10 usuarios · + orders, pipeline, reports básicos
- **Operaciones**: 25 usuarios · + inventory, analytics
- **Enterprise**: ilimitado · todos los módulos + reports avanzados

**`subscriptions`** (una activa por tenant)
- `tenant_id`, `plan_id`, `status` (`trial|active|suspended|cancelled`)
- `start_date`, `end_date`, `trial_end_date`
- `cancelled_at`, `notes`

**`tenant_feature_overrides`** (excepciones puntuales por tenant)
- `tenant_id`, `feature_code`, `enabled`, `reason`
- Permite habilitar/deshabilitar un módulo concreto fuera del plan

**`tenant_invitations`**
- `tenant_id`, `email`, `role` (app_role), `token`, `expires_at`, `accepted_at`, `invited_by`

### Enum extendido
- `app_role` ya existe (`superadmin, admin, sales, operations, finance, viewer`). Añadir alias semánticos:
  - `owner` → mapea a `admin` con flag `is_owner` en `user_tenants`
  - `warehouse` → nuevo valor del enum
- Añadir columnas a `user_tenants`: `is_owner bool default false`, `invited_at`, `last_active_at`

### Función SECURITY DEFINER
```sql
tenant_has_feature(_tenant_id uuid, _feature text) returns boolean
```
Combina `plans.features` + `tenant_feature_overrides` + estado de suscripción. Llamada desde RLS y desde el front.

```sql
current_subscription(_tenant_id uuid) returns subscriptions
```

### RLS
- `plans`: SELECT a `authenticated`
- `subscriptions`: SELECT a miembros del tenant; UPDATE solo a `superadmin` o `owner`
- `tenant_feature_overrides`: SELECT miembros; UPDATE owner/superadmin
- `tenant_invitations`: SELECT/INSERT/UPDATE solo owner/admin del tenant
- **Endurecer RLS de tablas de módulos** (quotations, sales_orders, products, stock_movements, customers) añadiendo `AND tenant_has_feature(tenant_id, '<modulo>')` a las policies de INSERT/UPDATE. Lectura se mantiene (para no perder datos al downgrade).

### Trigger
- `handle_new_user` actualizado: tras crear tenant, inserta `subscriptions` con plan **Comercial Trial** (`status='trial'`, `trial_end_date = now()+30 days`) y marca al usuario `is_owner=true`.

### Auditoría
Triggers `AFTER INSERT/UPDATE` en `subscriptions`, `user_tenants`, `tenant_feature_overrides` que escriben en `audit_logs` con acciones: `subscription.changed`, `user.role_changed`, `user.activated`, `user.deactivated`, `feature.toggled`.

---

## 2. Backend (server functions)

`src/lib/billing.functions.ts`
- `getCurrentSubscription()` — suscripción + plan + features efectivas + uso (conteo usuarios activos)
- `changePlan({ planCode })` — solo owner
- `cancelSubscription()`, `reactivateSubscription()`

`src/lib/tenant-admin.functions.ts`
- `listTenantUsers()` — miembros + estado + último acceso + rol
- `inviteUser({ email, role })` — crea invitación, genera token
- `acceptInvitation({ token })` — pública
- `setUserRole({ userId, role })`
- `setUserActive({ userId, isActive })`
- `getLicenseUsage()` — `{ used, max, percentage }`

Todas con `requireSupabaseAuth` + verificación de rol owner/admin.

---

## 3. Frontend

### Hooks reutilizables (`src/lib/`)
- `useSubscription()` — query del plan y features actuales (cacheada)
- `useFeature(code)` — boolean
- `useCanManageBilling()`, `useIsOwner()`

### Protección de rutas
- Componente `<FeatureGate feature="orders">` que renderiza `<UpgradePrompt>` si no está habilitado
- HOC en cada route file de módulo gated: `beforeLoad` valida feature vía server fn (bloqueo aunque manipulen URL)
- `AppSidebar.tsx`: filtra `mainNav` por features activas

### Pantallas nuevas
- `/settings/billing` — plan actual, uso, comparador de planes, botón cambiar/cancelar, banner de trial restante
- `/settings/team` — tabla de usuarios, invitar, activar/desactivar, cambiar rol, indicador de licencias `8/10`
- `/settings/features` — toggles de overrides (solo enterprise/superadmin)
- `/invite/$token` — pública, acepta invitación tras login
- Banner global cuando `trial_end_date - now() < 7 días`

### Roles UI
Mapeo `owner|admin|sales|warehouse|viewer` con matriz de permisos centralizada en `src/lib/permissions.ts`.

---

## 4. Trial y expiración
- Server fn programada (o verificación on-read en `getCurrentSubscription`) que marca `status='suspended'` cuando `trial_end_date < now()` y no hay upgrade.
- Estado `suspended`: solo lectura en todos los módulos (RLS bloquea INSERT/UPDATE).

---

## 5. Entregables por orden de ejecución

1. Migración SQL (tablas, enum, función `tenant_has_feature`, RLS, trigger trial, seeds de planes, triggers de auditoría)
2. Server functions de billing y tenant-admin
3. Hooks `useSubscription`, `useFeature`, `usePermissions`
4. `FeatureGate` + filtrado de sidebar + `beforeLoad` en rutas de módulos
5. Pantallas `/settings/billing`, `/settings/team`, `/invite/$token`
6. Banner de trial + bloqueo por suspensión

---

## Notas técnicas
- No se eliminan datos al hacer downgrade: las tablas quedan en solo-lectura.
- `superadmin` (rol global existente) puede operar cualquier tenant para soporte.
- Invitaciones por email se generan con token; el envío real queda como TODO (requeriría Resend o similar — preguntaré si lo necesitas ahora).
- Tipos TypeScript se regeneran automáticamente tras la migración.

¿Apruebas el plan para empezar con la migración SQL?
