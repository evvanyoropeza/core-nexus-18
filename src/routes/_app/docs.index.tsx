import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Package, FileText, ShoppingCart, KanbanSquare, BarChart3, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_app/docs/")({
  component: DocsIndex,
});

const modules = [
  { to: "/docs/customers", icon: Users, title: "Clientes", desc: "Alta, edición y segmentación." },
  { to: "/docs/products", icon: Package, title: "Productos e inventario", desc: "Catálogo, kardex y movimientos." },
  { to: "/docs/quotations", icon: FileText, title: "Cotizaciones", desc: "Crear, enviar y versionar." },
  { to: "/docs/pipeline", icon: KanbanSquare, title: "Pipeline comercial", desc: "Tablero Kanban por etapa." },
  { to: "/docs/orders", icon: ShoppingCart, title: "Órdenes", desc: "Conversión, surtido y stock." },
  { to: "/docs/reports", icon: BarChart3, title: "Reportes", desc: "Consultas, CSV e impresión." },
  { to: "/docs/roles", icon: ShieldCheck, title: "Roles y permisos", desc: "Perfiles, accesos e invitaciones." },
];

function DocsIndex() {
  return (
    <div className="space-y-6">
      <header>
        <h1>Bienvenido al manual</h1>
        <p>
          Aquí encontrarás guías paso a paso para usar cada módulo del ERP. Si es tu primera vez,
          te recomendamos seguir el orden: <strong>Clientes → Productos → Cotizaciones → Órdenes</strong>.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 not-prose">
        {modules.map((m) => (
          <Link key={m.to} to={m.to}>
            <Card className="h-full transition-shadow hover:shadow-elev-md">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="rounded-md bg-primary/10 p-2 text-primary">
                  <m.icon className="size-5" />
                </div>
                <div>
                  <div className="font-medium">{m.title}</div>
                  <div className="text-sm text-muted-foreground">{m.desc}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <section>
        <h2>¿Necesitas ayuda rápida?</h2>
        <p>
          Cada formulario incluye iconos <strong>(?)</strong> con explicaciones contextuales.
          Pasa el cursor sobre ellos para ver una descripción del campo. Si tienes dudas que no
          aparezcan en este manual, revisa la sección de{" "}
          <Link to="/docs/faq">Preguntas frecuentes</Link>.
        </p>
      </section>
    </div>
  );
}
