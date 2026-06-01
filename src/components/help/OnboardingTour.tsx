import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, Package, FileText, ShoppingCart, BookOpen, Rocket } from "lucide-react";

const STORAGE_KEY = "industria-erp.onboarding.v1";

const steps = [
  {
    icon: Rocket,
    title: "Bienvenido a tu ERP",
    body: "En menos de 1 minuto te mostramos los 4 módulos principales para que arranques con el pie derecho.",
  },
  {
    icon: Users,
    title: "1. Captura tus clientes",
    body: "Empieza dando de alta a quienes les vendes. Sus datos se reutilizan en cotizaciones y órdenes.",
  },
  {
    icon: Package,
    title: "2. Arma tu catálogo",
    body: "Define productos con SKU, precio base y categoría. Esto acelera la captura de cotizaciones.",
  },
  {
    icon: FileText,
    title: "3. Crea cotizaciones",
    body: "Genera propuestas profesionales en PDF, compártelas por link público y lleva historial de cada versión.",
  },
  {
    icon: ShoppingCart,
    title: "4. Convierte a órdenes",
    body: "Cuando el cliente acepte, conviértela en orden de venta con un clic y da seguimiento al cumplimiento.",
  },
  {
    icon: BookOpen,
    title: "Manual siempre disponible",
    body: "En cualquier momento entra a 'Ayuda' en el menú lateral para consultar guías detalladas y FAQs.",
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (!seen) setOpen(true);
  }, []);

  const finish = (goToDocs = false) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    }
    setOpen(false);
    if (goToDocs) navigate({ to: "/docs" });
  };

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : finish(false))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-6" />
          </div>
          <DialogTitle>{current.title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {current.body}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-1.5 py-2">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`size-1.5 rounded-full transition-colors ${
                i === step ? "bg-primary w-4" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => finish(false)}>
            Saltar
          </Button>
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              Atrás
            </Button>
          )}
          {!isLast ? (
            <Button onClick={() => setStep((s) => s + 1)}>Siguiente</Button>
          ) : (
            <Button onClick={() => finish(true)}>Abrir manual</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Botón opcional para relanzar el tour desde Configuración/Ayuda. */
export function restartOnboardingTour() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}
