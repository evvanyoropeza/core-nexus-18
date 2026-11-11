import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, ClipboardCheck, Package, RefreshCw, Truck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { notificationAccess, type NotificationKind } from "@/lib/notifications";
import { fetchNotifications, markNotificationsRead } from "@/lib/notifications-client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const icons = { approval: ClipboardCheck, stock: Package, dispatch: Truck };
export function NotificationBell() {
  const { user, currentTenant } = useAuth();
  const tenantId = currentTenant?.tenant_id;
  const userId = user?.id;
  const role = currentTenant?.role;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("unread");
  const [live, setLive] = useState(false);
  const queryKey = ["notifications", userId, tenantId, role];
  const query = useQuery({ queryKey, enabled: Boolean(tenantId && userId && role),
    queryFn: () => {
      if (!tenantId || !userId || !role) throw new Error("Sin empresa activa");
      return fetchNotifications(tenantId, userId, role);
    }, staleTime: 15000, refetchInterval: 60000,
  });
  useEffect(() => {
    if (!tenantId || !userId || !role) return;
    setOpen(false);
    setLive(false);
    const access = notificationAccess(role);
    const tables = ["notification_reads", ...(access.approval ? ["quotations"] : []),
      ...(access.stock ? ["products"] : []), ...(access.dispatch ? ["sales_orders"] : [])];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const invalidate = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void queryClient.invalidateQueries({ queryKey: ["notifications", userId, tenantId, role] }), 250);
    };
    const channel = supabase.channel(`notifications-${tenantId}-${Math.random().toString(36).slice(2)}`);
    for (const table of tables) channel.on("postgres_changes", {
      event: "*", schema: "public", table, filter: `tenant_id=eq.${tenantId}`,
    }, invalidate);
    channel.subscribe((status) => {
      setLive(status === "SUBSCRIBED");
      if (status === "SUBSCRIBED") invalidate();
    });
    return () => { clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [tenantId, userId, role, queryClient]);

  const markRead = useMutation({ mutationFn: (keys: string[]) => {
    if (!tenantId || !userId) throw new Error("Sin empresa activa");
    return markNotificationsRead(tenantId, userId, keys);
  }, onSuccess: (_data, keys) => {
    queryClient.setQueryData<Awaited<ReturnType<typeof fetchNotifications>>>(queryKey,
      (previous) => previous?.map((n) => keys.includes(n.key) ? { ...n, read: true } : n));
  }, onError: () => toast.error("No se pudo marcar el aviso como leído. Intenta nuevamente.") });
  const notifications = query.data ?? [];
  const unread = notifications.filter((n) => !n.read);
  const visible = tab === "unread" ? unread : notifications;
  const routeFor = (kind: NotificationKind) => kind === "approval" ? "/quotations/$quotationId" as const
    : kind === "stock" ? "/products/$productId" as const : "/orders/$orderId" as const;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="icon" className="relative shrink-0" title="Notificaciones"
        aria-label={`Notificaciones${unread.length ? `, ${unread.length} sin leer` : ""}`}>
        <Bell className="size-5" />
        {unread.length > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">{unread.length > 99 ? "99+" : unread.length}</span>}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-[400px] max-w-[calc(100vw-24px)] p-0" aria-label="Centro de notificaciones">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0"><h2 className="font-semibold">Notificaciones</h2>
          <p className="truncate text-xs text-muted-foreground">{currentTenant?.tenant.name}</p></div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" title="Actualizar avisos" aria-label="Actualizar avisos" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className={cn(query.isFetching && "motion-safe:animate-spin")} /></Button>
          <Button variant="ghost" size="icon" title="Marcar todos como leídos" aria-label="Marcar todos como leídos" disabled={!unread.length || markRead.isPending} onClick={() => markRead.mutate(unread.map((n) => n.key))}><CheckCheck /></Button>
        </div>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="px-4 pt-3">
        <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="unread">Sin leer ({unread.length})</TabsTrigger><TabsTrigger value="all">Todos ({notifications.length})</TabsTrigger></TabsList>
      </Tabs>
      <div className="max-h-[min(440px,60vh)] overflow-y-auto py-2" aria-live="polite">
        {query.isPending ? <p className="p-6 text-center text-sm text-muted-foreground">Cargando avisos…</p>
          : query.isError ? <div role="alert" className="p-6 text-center text-sm text-destructive">No se pudieron cargar los avisos.<Button variant="link" onClick={() => void query.refetch()}>Reintentar</Button></div>
          : visible.length === 0 ? <div className="flex flex-col items-center gap-2 p-8 text-center"><Bell className="size-7 text-muted-foreground" /><p className="text-sm font-medium">{tab === "unread" ? "Estás al día" : "Sin avisos pendientes"}</p></div>
          : visible.map((n) => {
            const Icon = icons[n.kind];
            const params = n.kind === "approval" ? { quotationId: n.entityId } : n.kind === "stock" ? { productId: n.entityId } : { orderId: n.entityId };
            return <div key={n.key} className={cn("flex items-start gap-3 border-b px-4 py-3 last:border-0", !n.read && "bg-accent/30")}>
              <Icon className={cn("mt-1 size-4 shrink-0", n.critical ? "text-destructive" : "text-primary")} />
              <Link to={routeFor(n.kind)} params={params} className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { if (!n.read) markRead.mutate([n.key]); setOpen(false); }}>
                <p className="break-words text-sm font-medium">{n.title}</p>
                <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">{n.detail}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{new Date(n.timestamp).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
              </Link>
              {!n.read && <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label={`Marcar como leído: ${n.title}`} title="Marcar como leído" disabled={markRead.isPending} onClick={() => markRead.mutate([n.key])}><Check /></Button>}
            </div>;
          })}
      </div>
      <div className="flex items-center gap-2 border-t px-4 py-2 text-[11px] text-muted-foreground"><span className={cn("size-1.5 rounded-full", live ? "bg-success" : "bg-warning")} />{live ? "En tiempo real" : "Actualización periódica"}</div>
    </PopoverContent>
  </Popover>;
}