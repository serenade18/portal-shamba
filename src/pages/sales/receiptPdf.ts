import type { Sale } from "@/api/types";
import type { Translator } from "@/i18n";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";

/** jsPDF's standard fonts cover Latin-1 only: map the few other characters we print. */
function latin1(text: string): string {
  return text
    .replace(/[−–—]/g, "-")
    .replace(/[  ]/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/Œ/g, "OE")
    .replace(/œ/g, "oe")
    .replace(/€/g, "EUR")
    .replace(/…/g, "...")
    .replace(/[^\u0000-ÿ]/g, "?");
}

/**
 * The sale as a one-page A5 receipt (SAL-05), for sharing to WhatsApp as a document.
 * jsPDF is loaded only when a receipt is made, so it stays out of the main bundle.
 */
export async function receiptPdf(t: Translator, sale: Sale, farm: string, currency: string): Promise<File> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const money = (v: string | number) => latin1(formatMoney(v, currency));
  const text = (s: string, x: number, y: number, opts?: { align?: "right" }) => doc.text(latin1(s), x, y, opts);
  const left = 14;
  const right = 134;
  let y = 18;

  doc.setFont("helvetica", "bold").setFontSize(16);
  text(farm, left, y);
  y += 8;
  doc.setFont("helvetica", "normal").setFontSize(11);
  text(t("receipt.pdf.title", { number: sale.number }), left, y);
  text(formatDate(sale.date, t.locale), right, y, { align: "right" });
  y += 6;
  doc.setTextColor(90);
  text(`${t("sale.customer")}: ${sale.customer_name}`, left, y);
  doc.setTextColor(0);
  y += 10;

  // Lines: product, quantity x price, amount.
  doc.setFontSize(9).setFont("helvetica", "bold");
  text(t("sale.product"), left, y);
  text(t("common.quantity"), 84, y, { align: "right" });
  text(t("common.total"), right, y, { align: "right" });
  doc.setDrawColor(200).line(left, y + 2, right, y + 2);
  y += 8;
  doc.setFont("helvetica", "normal").setFontSize(10);
  for (const l of sale.lines) {
    const name = doc.splitTextToSize(latin1(l.item_name[t.locale]), 50) as string[];
    doc.text(name, left, y);
    text(`${formatNumber(l.qty, 3)} ${t.unit(l.unit, Number(l.qty) === 1 ? 1 : 2)} x ${formatMoney(l.unit_price, currency)}`, 84, y, { align: "right" });
    text(money(Number(l.qty) * Number(l.unit_price)), right, y, { align: "right" });
    y += 6 * name.length + 1;
    if (y > 180) {
      doc.addPage();
      y = 18;
    }
  }
  doc.line(left, y - 3, right, y - 3);
  y += 3;

  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    text(label, 84, y, { align: "right" });
    text(value, right, y, { align: "right" });
    y += 6;
  };
  row(t("common.total"), money(sale.total), true);
  row(t("sales.col.paid"), money(sale.paid));
  row(t("sale.balance"), money(sale.balance_due), true);

  y += 8;
  doc.setFont("helvetica", "normal").setFontSize(11);
  text(t("receipt.pdf.thanks"), left, y);
  doc.setFontSize(8).setTextColor(130);
  text(t("receipt.pdf.footer"), left, 200);

  const blob = doc.output("blob");
  return new File([blob], `${t("receipt.pdf.file")}-${sale.number}.pdf`, { type: "application/pdf" });
}

/** True where the browser can hand a PDF to the share sheet (phones, most desktop browsers). */
export function canSharePdf(file: File): boolean {
  return typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
