# Industria ERP

ERP multi-tenant para PyMEs industriales: clientes, catálogo de productos, cotizaciones, órdenes de venta y auditoría — con manual integrado y onboarding guiado.

## Stack

- **Frontend / SSR**: [TanStack Start](https://tanstack.com/start) v1 sobre React 19 + Vite 7
- **Runtime**: Cloudflare Workers (con `nodejs_compat`)
- **Backend gestionado**: Lovable Cloud (Supabase) — Postgres + Auth + Storage
- **Server logic**: `createServerFn` de `@tanstack/react-start` (no Edge Functions)
- **Estilos**: Tailwind CSS v4 + shadcn/ui + tokens semánticos en `src/styles.css`
- **Estado de servidor**: TanStack Query
- **Formularios**: React Hook Form + Zod
- **PDF**: `pdf-lib` server-side
- **Lint / formato**: ESLint + Prettier

## Arquitectura de carpetas

```
src/
  routes/                    # Routing file-based de TanStack
    __root.tsx
    _app/                    # Layout autenticado (sidebar + topbar)
      dashboard.tsx
      customers.*
      products.*
      quotations.*
      orders.*
      docs.*                 # Manual de usuario in-app
    q.$token.tsx             # Vista pública de cotización por token
  components/
    app/                     # AppSidebar, TopBar
    auth/                    # AuthShell
    customers/  products/    # Forms por dominio
    help/                    # HelpHint, OnboardingTour
    ui/                      # shadcn primitives
  lib/
    auth.tsx                 # Contexto de auth y tenant
    customers.ts             # Helpers cliente Supabase por dominio
    products.ts
    quotations.ts
    orders.ts
    quotation-actions.ts
    quotations.functions.ts  # Server fns expuestos al cliente
    quotation-pdf.server.ts  # Generación PDF en el worker
  integrations/supabase/     # (autogenerado) — no editar
  start.ts                   # Bootstrap de TanStack Start + middleware
  router.tsx
supabase/
  migrations/                # Versionado de esquema
  config.toml
```

## Modelo de datos (resumen)

- `tenants` + `tenant_memberships` (multi-tenancy con roles `owner/admin/staff/viewer`)
- `customers`, `customer_addresses`
- `products`, `product_categories`
- `quotations`, `quotation_items`, `quotation_versions`, `quotation_share_tokens`
- `sales_orders`, `sales_order_items`
- `audit_logs`

Todas las tablas usan **RLS** y una función `has_role(user, tenant, role)` `SECURITY DEFINER` para evitar recursión.

## Seguridad

- RLS activa en cada tabla del esquema `public`.
- Roles almacenados en `tenant_memberships`, nunca en `profiles`.
- Server functions sensibles usan el middleware `requireSupabaseAuth`.
- El cliente admin (`client.server.ts`) solo se importa en archivos `*.server.ts` o rutas `/api/public/*`.

## Server functions

Patrón canónico (ver `src/lib/quotations.functions.ts`):

```ts
export const myFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // ...
  });
```

El bearer token se adjunta automáticamente desde el cliente vía `attachSupabaseAuth` (registrado en `src/start.ts`).

## Desarrollo local

Requiere Bun ≥ 1.1.

```bash
bun install
bun run dev          # http://localhost:5173
```

Variables de entorno (auto-provistas por Lovable Cloud, no editar manualmente `.env`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo runtime server)

## Migraciones

Cada cambio de esquema vive en `supabase/migrations/*.sql` y se aplica vía la integración de Lovable Cloud. Toda nueva tabla en `public` debe declarar `GRANT` + `ENABLE RLS` + políticas en la misma migración.

## Despliegue

Publicación gestionada por Lovable: `Publish` → Worker en Cloudflare. URL estable:

- Producción: `project--5d88dfab-2dc0-4476-bcf4-91944d86c2a9.lovable.app`
- Preview: `project--5d88dfab-2dc0-4476-bcf4-91944d86c2a9-dev.lovable.app`

## Roadmap

| Fase | Alcance | Estado |
|------|---------|--------|
| 1 | Auth + multi-tenant + layout | ✅ |
| 2 | Clientes | ✅ |
| 3 | Productos + categorías | ✅ |
| 4 | Cotizaciones (CRUD + PDF + link público + versionado + duplicar) | ✅ |
| 5 | Órdenes de venta + conversión | ✅ |
| 6 | Documentación: manual in-app, tour, tooltips, README | ✅ |
| — | Envío por email | ⏳ requiere dominio |
| — | Dashboards analíticos | ⏳ |
| — | Facturación / inventario | ⏳ |

## Convenciones

- Nunca usar clases de color crudas (`text-white`, `bg-blue-500`); siempre tokens semánticos.
- Nunca editar `src/integrations/supabase/{client,types,auth-*}.ts` ni `src/routeTree.gen.ts`.
- Nunca importar `client.server.ts` desde código de cliente.
- Server-side logic = `createServerFn`, no Edge Functions.
