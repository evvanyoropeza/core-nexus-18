import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, BarChart3, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { session, loading } = useAuth();
  if (!loading && session) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen bg-gradient-surface">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <div className="size-7 rounded-md bg-gradient-brand" />
          Industria ERP
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Iniciar sesión</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/register">
              Crear cuenta <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-20">
        <section className="mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground shadow-elev-sm">
            <span className="size-1.5 rounded-full bg-success" /> Multi-tenant · RBAC · Auditoría
          </div>
          <h1 className="text-balance text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
            El ERP industrial que reemplaza tus hojas de Excel.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            Clientes, catálogo, cotizaciones y analítica en una sola plataforma enterprise. Diseñado
            para equipos que necesitan precisión, trazabilidad y velocidad.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/register">
                Comenzar gratis <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">Ya tengo cuenta</Link>
            </Button>
          </div>
        </section>

        <section className="mt-24 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: ShieldCheck, title: "Seguridad enterprise", desc: "JWT, RBAC granular, RLS por empresa y auditoría completa." },
            { icon: Users, title: "Multi-empresa real", desc: "Aislamiento de datos por tenant con branding y fiscalidad propia." },
            { icon: BarChart3, title: "Analítica ejecutiva", desc: "Dashboards en tiempo real para ventas, operaciones y finanzas." },
            { icon: Zap, title: "UX productiva", desc: "Atajos, tablas tipo ERP y flujos pensados para alta velocidad." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-5 shadow-elev-sm">
              <f.icon className="size-5 text-primary" />
              <h3 className="mt-3 font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Industria ERP · Fase 1
      </footer>
    </div>
  );
}
