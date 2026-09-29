import { X } from "lucide-react";
import { useEffect, useRef, type FormEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n";
import { Button } from "./Button";

function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
}

/** Moves focus into the overlay and back to where it was when it closes. */
function useFocusReturn(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-close])");
    (first ?? ref.current)?.focus();
    return () => previous?.focus?.();
  }, [ref]);
}

/**
 * A side panel over the page, so the owner keeps context (7.4). With `onSubmit`
 * the body is a form and Enter submits it.
 */
export function SidePanel({ title, onClose, children, footer, onSubmit, wide }: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  onSubmit?: () => void;
  wide?: boolean;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEscape(onClose);
  useFocusReturn(ref);
  const inner = (
    <>
      <header>
        <h2>{title}</h2>
        <Button variant="quiet" onClick={onClose} aria-label={t("common.close")} icon={<X size={20} />} data-close />
      </header>
      <div className="body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </>
  );
  return createPortal(
    <>
      <div className="overlay" onClick={onClose} />
      <div ref={ref} className={`side-panel ${wide ? "side-panel-wide" : ""}`} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} tabIndex={-1}>
        {onSubmit ? (
          <form
            style={{ display: "contents" }}
            noValidate
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            {inner}
          </form>
        ) : (
          inner
        )}
      </div>
    </>,
    document.body,
  );
}

export function Dialog({ title, onClose, children, footer }: { title: ReactNode; onClose: () => void; children: ReactNode; footer: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(onClose);
  useFocusReturn(ref);
  return createPortal(
    <>
      <div className="overlay" onClick={onClose} />
      <div ref={ref} className="dialog" role="alertdialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} tabIndex={-1}>
        <header>
          <h2>{title}</h2>
        </header>
        <div className="body">{children}</div>
        <footer>{footer}</footer>
      </div>
    </>,
    document.body,
  );
}

/** Destructive confirmations use the filled terracotta button only here (8.1). */
export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onClose, loading, destructive = true }: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
  destructive?: boolean;
}) {
  const t = useT();
  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant={destructive ? "danger-fill" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {body}
    </Dialog>
  );
}

/** A dropdown that closes on outside click and Escape. */
export function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}
