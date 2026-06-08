import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { getSubscription } from "@/lib/billing.functions";

export type FeatureCode =
  | "customers"
  | "quotations"
  | "orders"
  | "inventory"
  | "reports"
  | "analytics"
  | "pipeline";

export function useSubscription() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.tenant_id;
  const fetchSub = useServerFn(getSubscription);
  return useQuery({
    queryKey: ["subscription", tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchSub({ data: { tenantId: tenantId! } }),
    staleTime: 60_000,
  });
}

export function useFeature(code: FeatureCode): { enabled: boolean; loading: boolean } {
  const q = useSubscription();
  if (q.isLoading) return { enabled: false, loading: true };
  const features = (q.data?.effectiveFeatures ?? []) as string[];
  return { enabled: features.includes(code), loading: false };
}

export function useIsOwner(): boolean {
  const { currentTenant } = useAuth();
  return currentTenant?.role === "admin";
}
