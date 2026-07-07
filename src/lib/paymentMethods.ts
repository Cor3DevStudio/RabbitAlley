export type PaymentMethod = "cash" | "gcash" | "debit" | "credit" | "bank" | "charge";
export type SplitMethod = "cash" | "gcash" | "bank" | "debit" | "credit" | "charge";

/** Methods where staff enter amount received / tendered (no card surcharge). */
export const MANUAL_AMOUNT_METHODS: PaymentMethod[] = ["cash", "gcash", "bank", "debit", "credit"];

export const CARD_PAYMENT_METHODS = ["debit", "credit"] as const;

export function normalizePaymentMethod(method: string | null | undefined): PaymentMethod {
  const m = String(method || "cash").toLowerCase().trim();
  if (m === "cash" || m === "gcash" || m === "debit" || m === "credit" || m === "bank" || m === "charge") {
    return m;
  }
  return "cash";
}

export function isCardPaymentMethod(method: string | null | undefined): boolean {
  const m = String(method || "").toLowerCase();
  return m === "debit" || m === "credit";
}

export function paymentMethodLabel(method: string | null | undefined): string {
  const m = normalizePaymentMethod(method);
  if (m === "cash") return "Cash";
  if (m === "gcash") return "GCash";
  if (m === "charge") return "Charge / Utang";
  return m.charAt(0).toUpperCase() + m.slice(1);
}
