import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { cx } from "@/lib/format";

type Variant = "primary" | "secondary" | "quiet" | "destructive" | "danger-fill";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "md" | "sm";
  icon?: ReactNode;
  loading?: boolean;
  block?: boolean;
}

export function Button({ variant = "secondary", size = "md", icon, loading, block, className, children, disabled, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      className={cx("btn", `btn-${variant}`, size === "sm" && "btn-sm", block && "btn-block", !children && "btn-icon", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "secondary", size = "md", icon, className, children, ...rest }: LinkProps & { variant?: Variant; size?: "md" | "sm"; icon?: ReactNode }) {
  return (
    <Link className={cx("btn", `btn-${variant}`, size === "sm" && "btn-sm", className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
