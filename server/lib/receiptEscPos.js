/**
 * Build ESC/POS buffers for QZ Tray / raw USB thermal printers (EPSON-compatible).
 */
const ESC = Buffer.from([0x1b]);
const GS = Buffer.from([0x1d]);

function concat(...parts) {
  return Buffer.concat(parts.map((p) => (Buffer.isBuffer(p) ? p : Buffer.from(p))));
}

function init() {
  return concat(ESC, Buffer.from("@"));
}
function align(n) {
  return concat(ESC, Buffer.from("a"), Buffer.from([n]));
} // 0 left 1 center
function bold(on) {
  return concat(ESC, Buffer.from("E"), Buffer.from([on ? 1 : 0]));
}
function sizeLarge() {
  return concat(GS, Buffer.from("!"), Buffer.from([0x11]));
}
function sizeNormal() {
  return concat(GS, Buffer.from("!"), Buffer.from([0]));
}
function cut() {
  // Feed paper first so printers do not cut text near the bottom.
  return concat(Buffer.from("\n\n\n", "ascii"), GS, Buffer.from("V"), Buffer.from([65, 0]));
}
function line(w, ch = "-") {
  return Buffer.from(ch.repeat(w) + "\n", "ascii");
}
function ln(s, w = 48) {
  const t = String(s ?? "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, " ")
    .slice(0, w);
  return Buffer.from(t + "\n", "latin1");
}

function buildCustomerReceipt(receipt, width = 48) {
  const businessName = String(receipt.businessName || "RABBIT ALLEY");
  const businessAddress = String(receipt.businessAddress || "123 Main Street, City");
  const businessContact = String(receipt.businessContact || "Tel: (02) 123-4567");
  const receiptFooter = String(receipt.receiptFooter || "Thank you for dining with us!");
  const vatTin = String(receipt.vatTin || "123-456-789-000");
  const serviceLabel = String(receipt.serviceLabel || "Service (10%)");
  const taxLabel = String(receipt.taxLabel || "VAT (12%)");
  const b = [init(), align(1), bold(true), sizeLarge(), ln(businessName, width), sizeNormal(), bold(false)];
  b.push(ln(businessAddress, width));
  b.push(ln(businessContact, width));
  b.push(line(width));
  b.push(align(0));
  b.push(ln(`Order #: ${receipt.orderNumber}`, width));
  b.push(ln(`Date: ${receipt.date}`, width));
  b.push(ln(`Time: ${receipt.time}`, width));
  b.push(ln(`Table: ${receipt.table}`, width));
  b.push(ln(`Cashier: ${receipt.cashier}`, width));
  b.push(line(width));
  b.push(bold(true), ln("ITEMS", width), bold(false));
  for (const item of receipt.items || []) {
    const itemLine = `${item.quantity}x ${item.name}`;
    const priceLine = `P${Number(item.subtotal).toFixed(2)}`;
    const pad = Math.max(1, width - itemLine.length - priceLine.length);
    b.push(ln(itemLine + " ".repeat(pad) + priceLine, width));
    const itemNote = item.note ?? item.specialRequest ?? item.comment;
    if (itemNote && String(itemNote).trim()) {
      b.push(ln("   Note: " + String(itemNote).trim().slice(0, width - 4), width));
    }
  }
  b.push(line(width));
  const pl = (label, val) => {
    const v = String(val);
    const pad = Math.max(1, width - label.length - v.length);
    b.push(ln(label + " ".repeat(pad) + v, width));
  };
  pl("Subtotal:", `P${Number(receipt.subtotal).toFixed(2)}`);
  if (receipt.complimentary) pl("Less Compli:", `-P${Number(receipt.complimentary).toFixed(2)}`);
  if (receipt.discount) pl("Discount:", `-P${Number(receipt.discount).toFixed(2)}`);
  pl(`${serviceLabel}:`, `P${Number(receipt.serviceCharge).toFixed(2)}`);
  pl(`${taxLabel}:`, `P${Number(receipt.tax).toFixed(2)}`);
  if (receipt.cardSurcharge) pl("Card Fee:", `P${Number(receipt.cardSurcharge).toFixed(2)}`);
  b.push(line(width));
  b.push(bold(true));
  pl("TOTAL:", `P${Number(receipt.total).toFixed(2)}`);
  b.push(bold(false));
  b.push(line(width));
  pl("Payment:", String(receipt.paymentMethod || "CASH").toUpperCase());
  pl("Amount Paid:", `P${Number(receipt.amountPaid).toFixed(2)}`);
  pl("Change:", `P${Number(receipt.change).toFixed(2)}`);
  b.push(line(width));
  b.push(align(1), ln("", width), bold(true), ln(receiptFooter, width), bold(false));
  b.push(ln("Please come again", width));
  b.push(ln("", width));
  b.push(ln("This serves as your OFFICIAL RECEIPT", width));
  b.push(ln(`VAT Reg TIN: ${vatTin}`, width));
  b.push(ln("", width), cut());
  return Buffer.concat(b);
}

function buildDeptChit({ dept, title, subtitle, items, table: tableStr, area, encoder, orderNumber, date, time }, width = 42) {
  const b = [init(), align(1), bold(true), sizeLarge(), ln(String(title || dept).toUpperCase(), width), sizeNormal(), bold(false)];
  if (subtitle) b.push(ln(subtitle, width));
  b.push(line(width));
  b.push(align(0));
  b.push(ln(`Order : ${orderNumber || ""}`, width));
  b.push(ln(`${date || ""}  ${time || ""}  ${area || ""} T${tableStr || ""}`, width));
  b.push(line(width));
  b.push(bold(true), ln("ITEMS", width), bold(false));
  if (dept === "LD") {
    const byLady = {};
    for (const item of items || []) {
      const key = item.servedByName || "Unassigned";
      if (!byLady[key]) byLady[key] = [];
      byLady[key].push(item);
    }
    for (const [lady, ladyItems] of Object.entries(byLady)) {
      b.push(bold(true), ln(`[${lady}]`, width), bold(false));
      for (const item of ladyItems) {
        const note = item.specialRequest ? ` (${item.specialRequest})` : "";
        b.push(ln(`  ${item.quantity}x ${item.name}${note}`.slice(0, width), width));
      }
    }
  } else {
    for (const item of items || []) {
      const note = item.specialRequest ? ` (${item.specialRequest})` : "";
      const server = item.servedByName ? ` [${item.servedByName}]` : "";
      b.push(ln(`${item.quantity}x ${item.name}${server}${note}`.slice(0, width), width));
    }
  }
  b.push(line(width));
  b.push(ln(`Encoder: ${encoder || ""}`, width));
  b.push(cut());
  return Buffer.concat(b);
}

function buildOrderSlip({ orderId, table: tableStr, area, waiter, date, time, subtotal, items }, width = 42) {
  const b = [init(), align(1), bold(true), ln("RABBIT ALLEY", width), bold(false)];
  b.push(ln("Bar & Restaurant", width));
  b.push(line(width));
  b.push(bold(true), ln("ORDER SLIP", width), bold(false));
  b.push(align(0));
  b.push(ln(`Order : ${orderId || ""}`, width));
  b.push(ln(`${date || ""}  ${time || ""}  ${area || ""} T${tableStr || ""}`, width));
  b.push(ln(`Waiter: ${waiter || ""}`, width));
  b.push(line(width));
  b.push(bold(true), ln("ITEMS", width), bold(false));
  for (const item of items || []) {
    const note = item.specialRequest ? ` (${item.specialRequest})` : "";
    const server = item.servedByName ? ` [${item.servedByName}]` : "";
    const price = `P${Number(item.subtotal).toFixed(2)}`;
    const label = `${item.quantity}x ${item.name}${server}${note}`.slice(0, width);
    const pad = Math.max(1, width - label.length - price.length);
    b.push(ln(label + " ".repeat(pad) + price, width));
  }
  b.push(line(width));
  const subStr = `P${Number(subtotal).toFixed(2)}`;
  const subPad = Math.max(1, width - "SUBTOTAL:".length - subStr.length);
  b.push(bold(true), ln("SUBTOTAL:" + " ".repeat(subPad) + subStr, width), bold(false));
  b.push(align(1));
  b.push(ln("Not official receipt.", width));
  b.push(ln("Subject to tax & service charge.", width));
  b.push(ln("Signature: ____________________", width));
  b.push(cut());
  return Buffer.concat(b);
}

export { buildCustomerReceipt, buildDeptChit, buildOrderSlip };
