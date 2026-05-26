import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/AuthShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

const schema = z.object({
  fullName: z.string().trim().min(2, "Tu nombre es requerido").max(100),
  organizationName: z.string().trim().min(2, "Nombre de empresa requerido").max(120),
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(128),
});

function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", organizationName: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setLoading(true);
    const redirectUrl = `${window.location.origin}/dashboard`;
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: parsed.data.fullName,
          organization_name: parsed.data.organizationName,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Cuenta creada. Revisa tu email para confirmar.");
    navigate({ to: "/login" });
  };

  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle="Configura tu empresa en menos de un minuto"
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Iniciar sesión
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Tu nombre</Label>
          <Input id="fullName" value={form.fullName} onChange={update("fullName")} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="organizationName">Nombre de la empresa</Label>
          <Input
            id="organizationName"
            value={form.organizationName}
            onChange={update("organizationName")}
            placeholder="Industrias Acme S.A. de C.V."
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email corporativo</Label>
          <Input id="email" type="email" value={form.email} onChange={update("email")} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={update("password")}
            placeholder="Mínimo 8 caracteres"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creando cuenta…" : "Crear cuenta"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Al continuar aceptas los Términos y la Política de Privacidad.
        </p>
      </form>
    </AuthShell>
  );
}
