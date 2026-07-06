/** Display label for an order tab or receipt (server order_number or numeric id). */
export function formatOrderDisplayNumber(orderNumber?: string | null, orderId?: string | null): string {
  const n = String(orderNumber ?? "").trim();
  if (n) return n;
  const id = String(orderId ?? "").trim();
  return id || "Draft";
}

/** Short tab label — matches printed slip sequence (e.g. 20240603-0034 → #34), not database id. */
export function formatOrderTabLabel(orderNumber?: string | null, orderId?: string | null): string {
  const n = String(orderNumber ?? "").trim();
  if (n.includes("-")) {
    const tail = n.split("-").pop() || n;
    const seq = parseInt(tail, 10);
    if (!Number.isNaN(seq)) return `#${seq}`;
    return `#${tail}`;
  }
  if (n) return `#${n}`;
  const id = String(orderId ?? "").trim();
  return id ? `#${id}` : "Draft";
}

export function formatOrderListLabel(orderNumbers: Array<string | null | undefined>): string {
  const labels = orderNumbers.map((n) => String(n ?? "").trim()).filter(Boolean);
  return labels.length ? labels.join(", ") : "—";
}
