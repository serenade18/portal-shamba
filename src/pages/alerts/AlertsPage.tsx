import { useMutation, useQuery } from "@tanstack/react-query";
import * as api from "@/api/endpoints";
import { useFarm, useKey } from "@/api/hooks";
import { Button } from "@/components/ui/Button";
import { PageHead } from "@/components/ui/data";
import { Chip, EmptyState, ErrorState, SkeletonRows } from "@/components/ui/feedback";
import { useT } from "@/i18n";
import { useInvalidateOrg } from "../enterprise/forms";
import { AlertRow } from "./AlertRow";

/** The in-app inbox behind the bell (8.6). Field workers never receive money alerts. */
export function AlertsPage() {
  const t = useT();
  const key = useKey();
  const { farm } = useFarm();
  const invalidate = useInvalidateOrg();
  const q = useQuery({ queryKey: key("alerts", farm?.id), queryFn: () => api.alerts.list(farm!.id), enabled: !!farm });
  const seen = useMutation({ mutationFn: (id: string) => api.alerts.seen(id), onSuccess: invalidate });
  const rows = q.data?.results ?? [];
  return (
    <>
      <PageHead title={t("alerts.title")} />
      {q.isLoading ? <SkeletonRows /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !rows.length ? (
        <div className="panel"><EmptyState text={t("alerts.none")} /></div>
      ) : (
        <div className="panel" style={{ padding: "4px 20px" }}>
          <div className="alert-list">
            {rows.map((a) => (
              <div key={a.id} className="spread" style={{ alignItems: "flex-start", borderTop: "1px solid var(--border)", marginTop: -1, opacity: a.status === "seen" ? 0.7 : 1 }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <AlertRow alert={a} />
                </div>
                <div style={{ paddingTop: 12 }}>
                  {a.status === "open" ? (
                    <Button size="sm" variant="quiet" loading={seen.isPending && seen.variables === a.id} onClick={() => seen.mutate(a.id)}>{t("alerts.markSeen")}</Button>
                  ) : (
                    <Chip tone="neutral">{t("alerts.seen")}</Chip>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
