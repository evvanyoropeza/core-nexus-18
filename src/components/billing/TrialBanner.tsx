import { Link } from "@tanstack/react-router";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/lib/subscription";

export function TrialBanner() {
  const { data } = useSubscription();
  if (!data?.subscription) return null;
  const sub = data.subscription;

  if (sub.status === "suspended" || sub.status === "cancelled") {
    return (
      <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-4" />
          <span className="flex-1">
            Tu suscripción está <strong>{sub.status === "suspended" ? "suspendida" : "cancelada"}</strong>.
            Solo puedes consultar datos. Reactiva un plan para seguir operando.
          </span>
          <Button asChild size="sm" variant="destructive">
            <Link to="/billing">Reactivar</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (sub.status === "trial" && data.trialDaysLeft != null && data.trialDaysLeft <= 7) {
    return (
      <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
          <Sparkles className="size-4" />
          <span className="flex-1">
            Tu período de prueba termina en <strong>{data.trialDaysLeft} día{data.trialDaysLeft === 1 ? "" : "s"}</strong>.
            Elige un plan para no perder acceso.
          </span>
          <Button asChild size="sm">
            <Link to="/billing">Elegir plan</Link>
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
