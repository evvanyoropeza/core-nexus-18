import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { acceptInvitation } from "@/lib/tenant-admin.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
});

function InvitePage() {
  const { token } = useParams({ from: "/invite/$token" });
  const { session, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const acceptFn = useServerFn(acceptInvitation);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!loading && session && !accepting) {
      setAccepting(true);
      acceptFn({ data: { token } })
        .then(async (res: any) => {
          if (res?.tenantId) {
            await supabase.from("profiles").update({ current_tenant_id: res.tenantId }).eq("id", session.user.id);
          }
          await refresh();
          toast.success("¡Bienvenido al equipo!");
          navigate({ to: "/dashboard" });
        })
        .catch((e: Error) => {
          toast.error(e.message);
          setAccepting(false);
        });
    }
  }, [loading, session, token, accepting, acceptFn, navigate, refresh]);

  if (!loading && !session) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Invitación al equipo</CardTitle>
            <CardDescription>
              Inicia sesión o crea una cuenta para aceptar esta invitación.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild className="flex-1">
              <Link to="/login" search={{ next: `/invite/${token}` } as any}>Iniciar sesión</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link to="/register">Crear cuenta</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
