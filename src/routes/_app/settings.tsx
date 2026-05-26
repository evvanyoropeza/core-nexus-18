import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, logAudit } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { currentTenant, hasRole, refresh } = useAuth();
  const qc = useQueryClient();
  const canEdit = hasRole("admin");
  const tenantId = currentTenant?.tenant_id;

  const { data: settings } = useQuery({
    queryKey: ["org-settings", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("organization_settings")
        .select("*")
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("*").eq("id", tenantId!).maybeSingle();
      return data;
    },
  });

  const [tForm, setTForm] = useState({ name: "", fiscal_id: "", fiscal_country: "MX", currency: "MXN", primary_color: "#635bff" });
  const [sForm, setSForm] = useState({ tax_rate: 16, currency: "MXN", payment_terms: "30 días", folio_prefix: "COT", folio_next: 1, pdf_footer: "" });

  useEffect(() => {
    if (tenant) {
      setTForm({
        name: tenant.name ?? "",
        fiscal_id: tenant.fiscal_id ?? "",
        fiscal_country: tenant.fiscal_country ?? "MX",
        currency: tenant.currency ?? "MXN",
        primary_color: tenant.primary_color ?? "#635bff",
      });
    }
  }, [tenant]);

  useEffect(() => {
    if (settings) {
      setSForm({
        tax_rate: Number(settings.tax_rate ?? 16),
        currency: settings.currency ?? "MXN",
        payment_terms: settings.payment_terms ?? "30 días",
        folio_prefix: settings.folio_prefix ?? "COT",
        folio_next: settings.folio_next ?? 1,
        pdf_footer: settings.pdf_footer ?? "",
      });
    }
  }, [settings]);

  const saveTenant = async () => {
    if (!tenantId) return;
    const { error } = await supabase.from("tenants").update(tForm).eq("id", tenantId);
    if (error) return toast.error(error.message);
    await logAudit({ tenantId, action: "tenant.update", entityType: "tenant", entityId: tenantId, metadata: tForm });
    toast.success("Empresa actualizada");
    qc.invalidateQueries({ queryKey: ["tenant", tenantId] });
    void refresh();
  };

  const saveSettings = async () => {
    if (!tenantId) return;
    const { error } = await supabase.from("organization_settings").update(sForm).eq("tenant_id", tenantId);
    if (error) return toast.error(error.message);
    await logAudit({ tenantId, action: "org_settings.update", entityType: "organization_settings", entityId: tenantId, metadata: sForm });
    toast.success("Configuración guardada");
    qc.invalidateQueries({ queryKey: ["org-settings", tenantId] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">Personaliza tu empresa, fiscalidad y branding.</p>
      </div>

      <Tabs defaultValue="company" className="space-y-4">
        <TabsList>
          <TabsTrigger value="company">Empresa</TabsTrigger>
          <TabsTrigger value="fiscal">Fiscal & Comercial</TabsTrigger>
          <TabsTrigger value="branding">Branding PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Datos de la empresa</CardTitle>
              <CardDescription>Información que verán tus clientes y aparecerá en documentos.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Razón social"><Input value={tForm.name} disabled={!canEdit} onChange={(e) => setTForm({ ...tForm, name: e.target.value })} /></Field>
              <Field label="RFC / ID fiscal"><Input value={tForm.fiscal_id} disabled={!canEdit} onChange={(e) => setTForm({ ...tForm, fiscal_id: e.target.value })} /></Field>
              <Field label="País fiscal"><Input value={tForm.fiscal_country} disabled={!canEdit} maxLength={2} onChange={(e) => setTForm({ ...tForm, fiscal_country: e.target.value.toUpperCase() })} /></Field>
              <Field label="Moneda base"><Input value={tForm.currency} disabled={!canEdit} maxLength={3} onChange={(e) => setTForm({ ...tForm, currency: e.target.value.toUpperCase() })} /></Field>
              <Field label="Color de marca">
                <div className="flex items-center gap-2">
                  <Input type="color" value={tForm.primary_color} disabled={!canEdit} onChange={(e) => setTForm({ ...tForm, primary_color: e.target.value })} className="h-10 w-16 p-1" />
                  <Input value={tForm.primary_color} disabled={!canEdit} onChange={(e) => setTForm({ ...tForm, primary_color: e.target.value })} />
                </div>
              </Field>
              <div className="sm:col-span-2">
                <Button onClick={saveTenant} disabled={!canEdit}>Guardar empresa</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fiscal">
          <Card>
            <CardHeader>
              <CardTitle>Configuración fiscal y comercial</CardTitle>
              <CardDescription>Aplica a cotizaciones, prefacturación y folios.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Tasa de impuesto (%)"><Input type="number" step="0.01" value={sForm.tax_rate} disabled={!canEdit} onChange={(e) => setSForm({ ...sForm, tax_rate: Number(e.target.value) })} /></Field>
              <Field label="Moneda"><Input value={sForm.currency} disabled={!canEdit} maxLength={3} onChange={(e) => setSForm({ ...sForm, currency: e.target.value.toUpperCase() })} /></Field>
              <Field label="Condiciones de pago"><Input value={sForm.payment_terms} disabled={!canEdit} onChange={(e) => setSForm({ ...sForm, payment_terms: e.target.value })} /></Field>
              <Field label="Prefijo de folio"><Input value={sForm.folio_prefix} disabled={!canEdit} maxLength={10} onChange={(e) => setSForm({ ...sForm, folio_prefix: e.target.value.toUpperCase() })} /></Field>
              <Field label="Próximo folio"><Input type="number" value={sForm.folio_next} disabled={!canEdit} onChange={(e) => setSForm({ ...sForm, folio_next: Number(e.target.value) })} /></Field>
              <div className="sm:col-span-2">
                <Button onClick={saveSettings} disabled={!canEdit}>Guardar configuración</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Branding de documentos PDF</CardTitle>
              <CardDescription>Texto legal que aparecerá al pie de tus cotizaciones.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Pie de página PDF">
                <Textarea rows={5} value={sForm.pdf_footer} disabled={!canEdit} onChange={(e) => setSForm({ ...sForm, pdf_footer: e.target.value })} placeholder="Términos, dirección, contacto, leyendas legales…" />
              </Field>
              <Button onClick={saveSettings} disabled={!canEdit}>Guardar branding</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {!canEdit && (
        <p className="text-xs text-muted-foreground">
          Solo los usuarios con rol <strong>admin</strong> pueden modificar la configuración de la empresa.
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
