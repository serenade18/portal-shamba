/** Kenyan numbers to E.164, the form the API keys users on. Returns null if it can't be a phone number. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  let d = digits.startsWith("+") ? digits.slice(1) : digits;
  if (d.startsWith("0")) d = `254${d.slice(1)}`;
  else if (/^[17]\d{8}$/.test(d)) d = `254${d}`;
  if (!/^254[17]\d{8}$/.test(d)) return null;
  return `+${d}`;
}

/** +254712345678 → 0712 345 678 */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+254(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : e164;
}
