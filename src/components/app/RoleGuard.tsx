import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { canSeeNav, ROLE_LABELS, type NavKey } from "@/lib/permissions";

export function AccessDenied({ role }: { role?: string | null }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <ShieldAlert className="size-6 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold tracking-tight">Acceso restringido</h1>
            <p className="text-sm text-muted-foreground">
              Tu perfil{role ? ` (${ROLE_LABELS[role] ?? role})` : ""} no tiene permisos para ver
              esta sección. Solicita acceso al administrador de tu empresa.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/dashboard">Volver al panel</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/** Protege una vista completa según la matriz de roles del tenant activo. */
export function RoleGuard({ nav, children }: { nav: NavKey; children: ReactNode }) {
  const { currentTenant, loading } = useAuth();
  const role = currentTenant?.role;

  if (loading || !currentTenant) {
    return <div className="text-sm text-muted-foreground">Cargando…</div>;
  }
  if (!canSeeNav(role, nav)) return <AccessDenied role={role} />;
  return <>{children}</>;
}
