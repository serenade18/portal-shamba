import type { ReactNode } from "react";
import { Brand } from "@/components/shell/Brand";
import { useT } from "@/i18n";

/** Split screen: the farmer photo under a Deep Forest scrim with the logo and brand line, the form on the right (7.7). */
export function SplitLayout({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <div className="split">
      <aside className="split-brand">
        <div className="logo">
          <Brand tagline />
        </div>
        <p className="line">{t("brand.line")}</p>
      </aside>
      <main className="split-form">
        <div className="card">{children}</div>
      </main>
    </div>
  );
}
