import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, Package, FileText, ShoppingCart, Boxes, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_app/reports/")({
  component: ReportsIndex,
});

const REPORTS = [
  {
    to: "/reports/customers" as const,
    title: "Clientes",
    desc: "Cartera con cotizaciones, órdenes y ventas por cliente.",
    icon: Users,
  },
  {
    to: "/reports/products" as const,
    title: "Productos",
    desc: "Catálogo con cantidades vendidas, ingresos y stock.",
    icon: Package,
  },
  {
    to: "/reports/inventory" as const,
    title: "Inventario",
    desc: "Movimientos de stock por entrada, salida o ajuste.",
    icon: Boxes,
  },
  {
    to: "/reports/quotations" as const,
    title: "Cotizaciones",
    desc: "Listado de cotizaciones por periodo y estatus.",
    icon: FileText,
  },
  {
    to: "/reports/sales" as const,
    title: "Ventas (Órdenes)",
    desc: "Órdenes confirmadas, surtidas y canceladas.",
    icon: ShoppingCart,
  },
];

function ReportsIndex() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Consulta e imprime reportes por categoría. Cada uno permite filtros por periodo y exportación a CSV.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Link key={r.to} to={r.to} className="group">
            <Card className="h-full transition-colors group-hover:border-primary/50">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <div className="rounded-md bg-primary/10 p-2 text-primary">
                  <r.icon className="size-5" />
                </div>
                <CardTitle className="text-base">{r.title}</CardTitle>
                <ArrowRight className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{r.desc}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
