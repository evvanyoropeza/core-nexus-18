import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Star, Trash2, Plus, Building2, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth, logAudit } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  customerSchema, contactSchema, nullifyEmpty, type Customer,
  type CustomerContact, type CustomerNote,
} from "@/lib/customers";
import { CustomerForm } from "@/components/customers/CustomerForm";

export const Route = createFileRoute("/_app/customers/$customerId")({
  component: CustomerDetailPage,
});

function CustomerDetailPage() {
  const { customerId } = Route.useParams();
  const { currentTenant, user, hasRole } = useAuth();
  const tenantId = currentTenant?.tenant_id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canEdit = hasRole(["admin", "sales", "operations"]);
  const canDelete = hasRole("admin");
  const [saving, setSaving] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", customerId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers").select("*").eq("id", customerId).single();
      if (error) throw error;
      return data as Customer;
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["customer-contacts", customerId],
    enabled: !!customer,
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_contacts").select("*")
        .eq("customer_id", customerId)
        .order("is_primary", { ascending: false })
        .order("name");
      return (data ?? []) as CustomerContact[];
    },
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["customer-notes", customerId],
    enabled: !!customer,
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_notes").select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      return (data ?? []) as CustomerNote[];
    },
  });

  const handleUpdate = async (values: unknown) => {
    if (!customer || !tenantId) return;
    const parsed = customerSchema.safeParse(values);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos"); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("customers")
        .update(nullifyEmpty(parsed.data))
        .eq("id", customer.id);
      if (error) throw error;
      await logAudit({
        tenantId, action: "customer.update", entityType: "customer",
        entityId: customer.id, metadata: { name: parsed.data.name },
      });
      toast.success("Cliente actualizado");
      qc.invalidateQueries({ queryKey: ["customer", customer.id] });
      qc.invalidateQueries({ queryKey: ["customers", tenantId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!customer || !tenantId) return;
    const { error } = await supabase.from("customers").delete().eq("id", customer.id);
    if (error) { toast.error(error.message); return; }
    await logAudit({
      tenantId, action: "customer.delete", entityType: "customer",
      entityId: customer.id, metadata: { name: customer.name },
    });
    toast.success("Cliente eliminado");
    qc.invalidateQueries({ queryKey: ["customers", tenantId] });
    navigate({ to: "/customers" });
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!customer) {
    return (
      <div className="space-y-4">
        <Link to="/customers" className="text-sm text-muted-foreground inline-flex items-center gap-1">
          <ArrowLeft className="size-4" /> Volver
        </Link>
        <p>Cliente no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link to="/customers" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-4" /> Clientes
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-2 flex items-center gap-2">
            <Building2 className="size-6 text-muted-foreground" />
            {customer.name}
            {!customer.is_active && <Badge variant="outline">Inactivo</Badge>}
          </h1>
          {customer.legal_name && (
            <p className="text-sm text-muted-foreground">{customer.legal_name}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-2">
            {(customer.tags ?? []).map((t) => (
              <Badge key={t} variant="secondary">{t}</Badge>
            ))}
          </div>
        </div>
        {canDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive">
                <Trash2 className="size-4" /> Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminará "{customer.name}" junto con sus contactos y notas. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="contacts">Contactos ({contacts.length})</TabsTrigger>
          <TabsTrigger value="notes">Notas ({notes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          {canEdit ? (
            <CustomerForm initial={customer} onSubmit={handleUpdate} submitting={saving} />
          ) : (
            <ReadOnlyInfo customer={customer} />
          )}
        </TabsContent>

        <TabsContent value="contacts" className="mt-4 space-y-4">
          <ContactsPanel
            customerId={customer.id}
            tenantId={tenantId!}
            canEdit={canEdit}
            contacts={contacts}
            onChange={() => qc.invalidateQueries({ queryKey: ["customer-contacts", customer.id] })}
          />
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-4">
          <NotesPanel
            customerId={customer.id}
            tenantId={tenantId!}
            userId={user?.id ?? null}
            canEdit={canEdit}
            notes={notes}
            onChange={() => qc.invalidateQueries({ queryKey: ["customer-notes", customer.id] })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReadOnlyInfo({ customer }: { customer: Customer }) {
  const rows: [string, string | null | undefined][] = [
    ["Razón social", customer.legal_name],
    ["RFC", customer.tax_id],
    ["Email", customer.email],
    ["Teléfono", customer.phone],
    ["Sitio web", customer.website],
    ["Dirección", [customer.address_line1, customer.address_line2, customer.city, customer.state, customer.postal_code, customer.country].filter(Boolean).join(", ")],
    ["Crédito", `$${Number(customer.credit_limit).toLocaleString()} · ${customer.credit_days} días`],
    ["Notas", customer.notes],
  ];
  return (
    <Card>
      <CardContent className="pt-6 grid sm:grid-cols-2 gap-4">
        {rows.map(([k, v]) => (
          <div key={k}>
            <div className="text-xs text-muted-foreground">{k}</div>
            <div className="text-sm">{v || "—"}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ContactsPanel({ customerId, tenantId, canEdit, contacts, onChange }: {
  customerId: string; tenantId: string; canEdit: boolean;
  contacts: CustomerContact[]; onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", position: "", email: "", phone: "", mobile: "", is_primary: false });
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("customer_contacts").insert({
        ...nullifyEmpty(parsed.data), customer_id: customerId, tenant_id: tenantId,
      });
      if (error) throw error;
      toast.success("Contacto agregado");
      setForm({ name: "", position: "", email: "", phone: "", mobile: "", is_primary: false });
      setOpen(false);
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("customer_contacts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Contacto eliminado");
    onChange();
  };

  return (
    <>
      {canEdit && (
        <Button size="sm" variant={open ? "outline" : "default"} onClick={() => setOpen((v) => !v)}>
          <Plus className="size-4" /> {open ? "Cancelar" : "Nuevo contacto"}
        </Button>
      )}
      {open && (
        <Card>
          <CardHeader><CardTitle className="text-base">Nuevo contacto</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
              <div><Label>Nombre *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} /></div>
              <div><Label>Puesto</Label><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} maxLength={120} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} /></div>
              <div><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={40} /></div>
              <div><Label>Móvil</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} maxLength={40} /></div>
              <div className="flex items-center gap-2 mt-6">
                <Switch checked={form.is_primary} onCheckedChange={(v) => setForm({ ...form, is_primary: v })} />
                <Label>Contacto principal</Label>
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin contactos.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {contacts.map((c) => (
            <Card key={c.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {c.name}
                      {c.is_primary && <Star className="size-3.5 fill-primary text-primary" />}
                    </div>
                    {c.position && <div className="text-xs text-muted-foreground">{c.position}</div>}
                    {c.email && <div className="text-sm mt-2 flex items-center gap-1.5"><Mail className="size-3.5 text-muted-foreground" />{c.email}</div>}
                    {c.phone && <div className="text-sm flex items-center gap-1.5"><Phone className="size-3.5 text-muted-foreground" />{c.phone}</div>}
                    {c.mobile && <div className="text-sm flex items-center gap-1.5"><Phone className="size-3.5 text-muted-foreground" />{c.mobile} (móvil)</div>}
                  </div>
                  {canEdit && (
                    <Button variant="ghost" size="icon" onClick={() => remove(c.id)} aria-label="Eliminar contacto">
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function NotesPanel({ customerId, tenantId, userId, canEdit, notes, onChange }: {
  customerId: string; tenantId: string; userId: string | null; canEdit: boolean;
  notes: CustomerNote[]; onChange: () => void;
}) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId || !content.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("customer_notes").insert({
        customer_id: customerId, tenant_id: tenantId, author_id: userId,
        content: content.trim().slice(0, 2000),
      });
      if (error) throw error;
      setContent("");
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally { setSaving(false); }
  };

  return (
    <>
      {canEdit && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={submit} className="space-y-2">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Agregar nota o seguimiento…"
                rows={3}
                maxLength={2000}
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={saving || !content.trim()}>
                  {saving ? "Guardando…" : "Agregar nota"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin notas todavía.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <Card key={n.id}>
              <CardContent className="pt-4 pb-4">
                <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
