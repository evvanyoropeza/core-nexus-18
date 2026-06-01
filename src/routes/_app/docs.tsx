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
        <article className="docs-content max-w-3xl space-y-4 text-sm leading-relaxed text-foreground [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:mt-8 [&_h2]:mb-2 [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1.5 [&_li]:text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_strong]:text-foreground [&_strong]:font-medium">
          <Outlet />
        </article>
      </main>
    </div>
  );
}
