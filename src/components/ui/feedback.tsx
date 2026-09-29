import { AlertTriangle, CheckCircle2, Clock, CloudRain, Info, Lock, Minus, XCircle } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useT } from "@/i18n";
import { useToasts } from "@/stores/toast";
import { useErrorText } from "@/api/hooks";
import { ButtonLink, Button } from "./Button";

export type Tone = "health" | "amber" | "terracotta" | "lavender" | "sky" | "neutral";

const TONE_ICON: Record<Tone, ReactNode> = {
  health: <CheckCircle2 size={14} aria-hidden />,
  amber: <Clock size={14} aria-hidden />,
  terracotta: <AlertTriangle size={14} aria-hidden />,
  lavender: <Info size={14} aria-hidden />,
  sky: <CloudRain size={14} aria-hidden />,
  neutral: <Minus size={14} aria-hidden />,
};

/** Pill with a tint, ink text and an icon, so meaning never depends on colour alone (8.3). */
export function Chip({ tone, children, icon }: { tone: Tone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={`chip chip-${tone}`}>
      {icon ?? TONE_ICON[tone]}
      {children}
    </span>
  );
}

export function Skeleton({ height = 16, width = "100%", style }: { height?: number; width?: number | string; style?: CSSProperties }) {
  return <div className="skeleton" style={{ height, width, ...style }} aria-hidden />;
}

/** Skeleton rows in Sand matching the final layout; no spinners for page loads (9). */
export function SkeletonRows({ rows = 5, height = 48 }: { rows?: number; height?: number }) {
  return (
    <div className="panel" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ padding: "12px 16px", borderTop: i ? "1px solid var(--border)" : undefined }}>
          <Skeleton height={height - 24} width={`${70 - ((i * 13) % 30)}%`} />
        </div>
      ))}
    </div>
  );
}

/** An invitation to act, never a mood (9). */
export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <p className="muted">{text}</p>
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useT();
  const text = useErrorText()(error);
  return (
    <div className="panel">
      <div className="empty">
        <p className="ink-cost">{text}</p>
        {onRetry && <Button onClick={onRetry}>{t("common.retry")}</Button>}
      </div>
    </div>
  );
}

export function NoPermission({ text }: { text?: string }) {
  const t = useT();
  return (
    <div className="panel">
      <div className="empty">
        <p className="row" style={{ gap: 8 }}>
          <Lock size={18} aria-hidden className="muted" />
          {text ?? t("state.noPermission")}
        </p>
      </div>
    </div>
  );
}

export function ModuleHidden({ typeLabel }: { typeLabel: string }) {
  const t = useT();
  return (
    <div className="panel">
      <div className="empty">
        <p>{t("state.moduleHidden", { type: typeLabel })}</p>
        <ButtonLink to="/settings?tab=keep" variant="primary">{t("state.openSettings")}</ButtonLink>
      </div>
    </div>
  );
}

export function Notice({ tone = "neutral", children, icon }: { tone?: "neutral" | "error" | "amber" | "health" | "info"; children: ReactNode; icon?: ReactNode }) {
  return (
    <div className={`notice ${tone === "neutral" ? "" : `notice-${tone}`}`} role={tone === "error" ? "alert" : undefined}>
      {icon}
      <div>{children}</div>
    </div>
  );
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone === "error" ? "error" : ""}`}>
          {t.tone === "error" ? <XCircle size={18} aria-hidden /> : <CheckCircle2 size={18} aria-hidden />}
          {t.text}
        </div>
      ))}
    </div>
  );
}
