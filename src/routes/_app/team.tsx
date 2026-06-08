import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, Mail, Shield, Power, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useIsOwner, useSubscription } from "@/lib/subscription";
import { ROLE_LABELS } from "@/lib/permissions";
import {
  listTenantUsers, inviteUser, setUserRole, setUserActive, revokeInvitation,
} from "@/lib/tenant-admin.functions";

export const Route = createFileRoute("/_app/team")({
  component: TeamPage,
});

const ROLES = ["admin", "sales", "operations", "warehouse", "finance", "viewer"] as const;

function TeamPage() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.tenant_id;
  const isOwner = useIsOwner();
  const subQ = useSubscription();
  const qc = useQueryClient();

  const fetchUsers = useServerFn(listTenantUsers);
  const usersQ = useQuery({
    queryKey: ["team", tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchUsers({ data: { tenantId: tenantId! } }),
  });

  const inviteFn = useServerFn(inviteUser);
  const roleFn = useServerFn(setUserRole);
  const activeFn = useServerFn(setUserActive);
  const revokeFn = useServerFn(revokeInvitation);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["team", tenantId] });

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("sales");

  const inviteMut = useMutation({
    mutationFn: () => inviteFn({ data: { tenantId: tenantId!, email, role } }),
    onSuccess: (inv: any) => {
      toast.success("Invitación creada");
      const url = `${window.location.origin}/invite/${inv.token}`;
      navigator.clipboard?.writeText(url).catch(() => {});
      toast.info("Link copiado al portapapeles");
      setOpen(false); setEmail("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMut = useMutation({
    mutationFn: (v: { userId: string; role: any }) => roleFn({ data: { tenantId: tenantId!, ...v } }),
    onSuccess: () => { toast.success("Rol actualizado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const activeMut = useMutation({
    mutationFn: (v: { userId: string; isActive: boolean }) =>
      activeFn({ data: { tenantId: tenantId!, ...v } }),
    onSuccess: () => { toast.success("Usuario actualizado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const revokeMut = useMutation({
    mutationFn: (invitationId: string) => revokeFn({ data: { tenantId: tenantId!, invitationId } }),
    onSuccess: () => { toast.success("Invitación revocada"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const usage = subQ.data?.usage;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipo</h1>
          <p className="text-sm text-muted-foreground">
            Administra los usuarios de tu empresa, sus roles y permisos.
          </p>
        </div>
        {isOwner && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="mr-2 size-4" /> Invitar usuario</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invitar usuario</DialogTitle>
                <DialogDescription>Se generará un link de invitación válido por 7 días.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Rol</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => inviteMut.mutate()} disabled={!email || inviteMut.isPending}>
                  <Mail className="mr-2 size-4" /> Enviar invitación
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Licencias</CardTitle>
          <CardDescription>
            {usage?.activeUsers ?? 0}
            {usage?.maxUsers ? ` de ${usage.maxUsers}` : " (ilimitado)"} usuarios activos
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader><CardTitle>Miembros</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(usersQ.data?.members ?? []).map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="font-medium">{m.profile?.full_name ?? "—"}</div>
                    {m.is_owner && <Badge variant="secondary" className="mt-1"><Shield className="mr-1 size-3" />Propietario</Badge>}
                  </TableCell>
                  <TableCell>
                    {isOwner && !m.is_owner ? (
                      <Select value={m.role} onValueChange={(v) => roleMut.mutate({ userId: m.user_id, role: v })}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">{ROLE_LABELS[m.role] ?? m.role}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.is_active ? "default" : "destructive"}>
                      {m.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {isOwner && !m.is_owner && (
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => activeMut.mutate({ userId: m.user_id, isActive: !m.is_active })}
                      >
                        <Power className="mr-1 size-4" />
                        {m.is_active ? "Desactivar" : "Activar"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(usersQ.data?.invitations ?? []).length > 0 && (
        <Card>
          <CardHeader><CardTitle>Invitaciones pendientes</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(usersQ.data?.invitations ?? []).map((i: any) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.email}</TableCell>
                    <TableCell><Badge variant="outline">{ROLE_LABELS[i.role] ?? i.role}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(i.expires_at).toLocaleDateString("es-MX")}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => {
                          const url = `${window.location.origin}/invite/${i.token}`;
                          navigator.clipboard?.writeText(url);
                          toast.success("Link copiado");
                        }}
                      >
                        Copiar link
                      </Button>
                      {isOwner && (
                        <Button variant="ghost" size="sm" onClick={() => revokeMut.mutate(i.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
