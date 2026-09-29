import { useT } from "@/i18n";

/**
 * The Shamba OS logo for dark surfaces: the leaf mark and the wordmark, with
 * "OS" in the logo's green. The source artwork is in public/brand.
 */
export function Brand({ tagline = false }: { tagline?: boolean }) {
  const t = useT();
  return (
    <>
      <img src="/logo.svg" alt="" className="brand-mark" />
      <span className="wordmark">
        <span>
          Shamba <b>OS</b>
        </span>
        {tagline && <small>{t("brand.tagline")}</small>}
      </span>
    </>
  );
}
