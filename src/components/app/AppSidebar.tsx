import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  History,
  Settings,
  Building2,
  ChevronsUpDown,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mainNav: Array<{ to: string; label: string; icon: typeof LayoutDashboard; soon?: boolean }> = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customers", label: "Clientes", icon: Users },
  { to: "/products", label: "Productos", icon: Package, soon: true },
  { to: "/quotations", label: "Cotizaciones", icon: FileText, soon: true },
];

const orgNav = [
  { to: "/audit", label: "Actividad", icon: History },
  { to: "/settings", label: "Configuración", icon: Settings },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { currentTenant, memberships, switchTenant } = useAuth();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-gradient-brand text-primary-foreground">
                <Building2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {currentTenant?.tenant.name ?? "Sin empresa"}
                </span>
                <span className="truncate text-xs text-muted-foreground capitalize">
                  {currentTenant?.role ?? "—"}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 opacity-50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-xs">Tus empresas</DropdownMenuLabel>
            {memberships.map((m) => (
              <DropdownMenuItem key={m.tenant_id} onClick={() => switchTenant(m.tenant_id)}>
                <Building2 className="mr-2 size-4" />
                <div className="flex flex-col">
                  <span>{m.tenant.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>+ Nueva empresa (próximamente)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.label}>
                    {item.soon ? (
                      <button type="button" className="opacity-60 cursor-not-allowed" disabled>
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                          pronto
                        </span>
                      </button>
                    ) : (
                      <Link to={item.to}>
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Organización</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {orgNav.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.label}>
                    <Link to={item.to}>
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
          Industria ERP · v0.1 · Fase 1
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
