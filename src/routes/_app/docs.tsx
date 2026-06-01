import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Users,
  Package,
  FileText,
  ShoppingCart,
  HelpCircle,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/docs")({
  component: DocsLayout,
});

const sections = [
  { to: "/docs", label: "Introducción", icon: Rocket, exact: true },
  { to: "/docs/customers", label: "Clientes", icon: Users },
  { to: "/docs/products", label: "Productos", icon: Package },
  { to: "/docs/quotations", label: "Cotizaciones", icon: FileText },
  { to: "/docs/orders", label: "Órdenes de venta", icon: ShoppingCart },
  { to: "/docs/faq", label: "Preguntas frecuentes", icon: HelpCircle },
];

function DocsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="flex items-center gap-2 px-2 pb-3 text-sm font-medium text-muted-foreground">
          <BookOpen className="size-4" />
          Manual de usuario
        </div>
        <nav className="flex flex-col gap-1">
          {sections.map((s) => {
            const active = s.exact ? pathname === s.to : pathname === s.to;
            return (
              <Link
                key={s.to}
                to={s.to}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted",
                  active && "bg-muted font-medium text-foreground",
                )}
              >
                <s.icon className="size-4" />
                {s.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="min-w-0">
        <article className="prose prose-sm max-w-none dark:prose-invert prose-headings:scroll-m-20 prose-headings:tracking-tight">
          <Outlet />
        </article>
      </main>
    </div>
  );
}
