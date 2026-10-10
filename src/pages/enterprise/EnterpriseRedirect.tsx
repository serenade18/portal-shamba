import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation, useParams } from "react-router";
import * as api from "@/api/endpoints";
import { useKey } from "@/api/hooks";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { enterprisePath } from "./paths";

/** /e/{id}: an enterprise named without its module (alerts carry only the id). Keeps ?tab= and the like. */
export function EnterpriseRedirect() {
  const { id = "" } = useParams();
  const { search } = useLocation();
  const key = useKey();
  const q = useQuery({ queryKey: key("enterprise", id), queryFn: () => api.enterprises.get(id) });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <Skeleton height={200} />;
  return <Navigate to={`${enterprisePath(q.data.module, q.data.id)}${search}`} replace />;
}
