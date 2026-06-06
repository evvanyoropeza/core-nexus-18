import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Printer, ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Period = { from: string; to: string };

export function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function PeriodPicker({
  value,
  onChange,
  presets = true,
}: {
  value: Period;
  onChange: (p: Period) => void;
  presets?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 print:hidden">
      <div>
        <Label className="text-xs">Desde</Label>
        <Input
          type="date"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="h-9 w-[160px]"
        />
      </div>
      <div>
        <Label className="text-xs">Hasta</Label>
        <Input
          type="date"
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="h-9 w-[160px]"
        />
      </div>
      {presets && (
        <div className="flex gap-1">
          {[
            { d: 7, l: "7d" },
            { d: 30, l: "30d" },
            { d: 90, l: "90d" },
            { d: 365, l: "1a" },
          ].map((p) => (
            <Button
              key={p.d}
              variant="outline"
              size="sm"
              type="button"
              onClick={() => onChange({ from: todayISO(-p.d + 1), to: todayISO() })}
            >
              {p.l}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ReportShell({
  title,
  subtitle,
  filters,
  onExport,
  children,
}: {
  title: string;
  subtitle?: string;
  filters?: ReactNode;
  onExport?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/reports">
              <ArrowLeft className="size-4" /> Reportes
            </Link>
          </Button>
        </div>
        <div className="flex gap-2">
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="size-4" /> CSV
            </Button>
          )}
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimir
          </Button>
        </div>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </header>

      {filters}

      <div className="rounded-lg border bg-card p-4 text-card-foreground print:border-0 print:p-0 print:shadow-none">
        {children}
      </div>

      <footer className="hidden text-xs text-muted-foreground print:block">
        Generado el {new Date().toLocaleString()}
      </footer>
    </div>
  );
}
