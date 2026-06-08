import { Link } from "@tanstack/react-router";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFeature, type FeatureCode } from "@/lib/subscription";

interface Props {
  feature: FeatureCode;
  children: React.ReactNode;
  title?: string;
}

export function FeatureGate({ feature, children, title }: Props) {
  const { enabled, loading } = useFeature(feature);
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (enabled) return <>{children}</>;
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md text-center">
        <CardHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <Lock className="size-6 text-muted-foreground" />
          </div>
          <CardTitle className="mt-2">{title ?? "Módulo no disponible"}</CardTitle>
          <CardDescription>
            Este módulo no está incluido en tu plan actual. Actualiza tu suscripción para acceder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/billing">
              <Sparkles className="mr-2 size-4" />
              Ver planes
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
