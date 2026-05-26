import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden bg-gradient-brand lg:flex lg:flex-col lg:justify-between lg:p-12 lg:text-primary-foreground">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
          <div className="size-7 rounded-md bg-white/20 backdrop-blur" />
          Industria ERP
        </Link>
        <div>
          <p className="max-w-md text-2xl font-medium leading-snug">
            "Pasamos de 14 hojas de cálculo a una sola plataforma. La trazabilidad y los tiempos
            de respuesta cambiaron por completo."
          </p>
          <p className="mt-3 text-sm opacity-80">— Cliente piloto, industria metal-mecánica</p>
        </div>
        <p className="text-xs opacity-70">© {new Date().getFullYear()} Industria ERP</p>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="mb-8 flex items-center gap-2 font-semibold lg:hidden">
            <div className="size-7 rounded-md bg-gradient-brand" />
            Industria ERP
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
