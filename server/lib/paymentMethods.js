export function normalizePaymentMethod(method) {
  const m = String(method || "cash").toLowerCase().trim();
  if (m === "cash" || m === "gcash" || m === "debit" || m === "credit" || m === "bank" || m === "charge") {
    return m;
  }
  return "cash";
}

export function isCardPaymentMethod(method) {
  const m = String(method || "").toLowerCase();
  return m === "debit" || m === "credit";
}

export const SALES_CASH_COND = "payment_method = 'cash'";
export const SALES_CARD_COND = "payment_method IN ('credit','debit')";
export const SALES_GCASH_COND = "payment_method = 'gcash'";
export const SALES_BANK_COND = "payment_method = 'bank'";
