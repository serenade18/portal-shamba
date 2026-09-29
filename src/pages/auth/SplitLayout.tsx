import type { ReactNode } from "react";
import { Brand } from "@/components/shell/Brand";
import { useT } from "@/i18n";

/** Split screen: Deep Forest gradient with the brand line, the form on the right (7.7). */
export function SplitLayout({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <div className="split">
      <aside className="split-brand">
        <div className="logo">
          <Brand tagline />
        </div>
        <div className="stack">
          <p className="line">{t("brand.line")}</p>
        </div>
        <span className="hide-sm" />
      </aside>
      <main className="split-form">
        <div className="card">{children}</div>
      </main>
    </div>
  );
}
