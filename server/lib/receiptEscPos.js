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
  return concat(Buffer.from("\n\n\n\n\n\n", "ascii"), GS, Buffer.from("V"), Buffer.from([65, 0]));
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

function cleanText(value) {
  return String(value ?? "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapText(value, width) {
  const max = Math.max(1, Number(width) || 1);
  const text = cleanText(value);
  if (!text) return [""];
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      if (word.length <= max) {
        current = word;
      } else {
        for (let i = 0; i < word.length; i += max) {
          lines.push(word.slice(i, i + max));
        }
      }
      continue;
    }
    const candidate = `${current} ${word}`;
    if (candidate.length <= max) {
      current = candidate;
      continue;
    }
    lines.push(current);
    if (word.length <= max) {
      current = word;
    } else {
      for (let i = 0; i < word.length; i += max) {
        const chunk = word.slice(i, i + max);
        if (i + max >= word.length) current = chunk;
        else lines.push(chunk);
      }
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function pushWrappedLine(parts, value, width, indent = "") {
  const wrapped = wrapText(value, Math.max(1, width - indent.length));
  for (const lineText of wrapped) {
    parts.push(ln(indent + lineText, width));
  }
}

function buildCustomerReceipt(receipt, width = 48) {
  const businessName = cleanText(receipt.businessName);
  const businessAddress = cleanText(receipt.businessAddress);
  const businessContact = cleanText(receipt.businessContact);
  const receiptFooter = cleanText(receipt.receiptFooter);
  const vatTin = cleanText(receipt.vatTin);
  const serviceLabel = String(receipt.serviceLabel || "Service (10%)");
  const taxLabel = String(receipt.taxLabel || "VAT (12%)");
  const isReprint =
    receipt.isReprint === true ||
    receipt.isReprint === 1 ||
    receipt.isReprint === "1" ||
    /^reprint/i.test(String(receipt.paymentMethod || ""));
  const originalPaymentMethod = isReprint && /^reprint/i.test(String(receipt.paymentMethod || ""))
    ? (receipt.originalPaymentMethod || receipt.paymentMethodOriginal || null)
    : (receipt.paymentMethod || null);
  const b = [init(), align(1), bold(true), sizeLarge()];
  if (businessName) b.push(ln(businessName, width));
  b.push(sizeNormal(), bold(false));
  if (businessAddress) b.push(ln(businessAddress, width));
  if (businessContact) b.push(ln(businessContact, width));
  b.push(line(width));
  if (isReprint) {
    b.push(bold(true), align(1), ln("** REPRINT COPY **", width), bold(false), align(0));
    b.push(line(width));
  }
  b.push(align(0));
  b.push(ln(`Order #: ${receipt.orderNumber}`, width));
  b.push(ln(`Date: ${receipt.date}`, width));
  b.push(ln(`Time: ${receipt.time}`, width));
  b.push(ln(`Table: ${receipt.table}`, width));
  b.push(ln(`Cashier: ${receipt.cashier}`, width));
  b.push(line(width));
  b.push(bold(true), ln("ITEMS", width), bold(false));
  for (const item of receipt.items || []) {
    const itemLine = cleanText(`${item.quantity}x ${item.name}`);
    const priceLine = item.subtotal === 0 ? "0.00" : `P${Number(item.subtotal).toFixed(2)}`;
    const nameWidth = Math.max(1, width - priceLine.length - 1);
    const wrappedItem = wrapText(itemLine, nameWidth);
    const lastLine = wrappedItem.pop() || "";
    for (const part of wrappedItem) {
      b.push(ln(part, width));
    }
    const pad = Math.max(1, width - lastLine.length - priceLine.length);
    b.push(ln(lastLine + " ".repeat(pad) + priceLine, width));
    const itemNote = item.note ?? item.specialRequest ?? item.comment;
    if (itemNote && String(itemNote).trim()) {
      pushWrappedLine(b, `Note: ${itemNote}`, width, "   ");
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
  const payMethod = originalPaymentMethod || receipt.paymentMethod || "CASH";
  const payLabel = /^reprint/i.test(String(payMethod)) ? "—" : String(payMethod).toUpperCase();
  pl("Payment:", payLabel);
  pl("Amount Paid:", `P${Number(receipt.amountPaid).toFixed(2)}`);
  const receiptChange = Math.max(
    0,
    Number(
      receipt.change != null
        ? receipt.change
        : Number(receipt.amountPaid || 0) - Number(receipt.total || 0)
    )
  );
  if (/^CASH$/i.test(payLabel) || receiptChange > 0) {
    pl("Change:", `P${receiptChange.toFixed(2)}`);
  }
  b.push(line(width));
  b.push(align(1), ln("", width));
  if (receiptFooter) {
    b.push(bold(true), ln(receiptFooter, width), bold(false));
  }
  b.push(ln("Please come again", width));
  b.push(ln("", width));
  b.push(ln("This serves as your OFFICIAL RECEIPT", width));
  if (vatTin) b.push(ln(`VAT Reg TIN: ${vatTin}`, width));
  if (isReprint) {
    b.push(ln("", width));
    b.push(bold(true), ln("** REPRINT — NOT A DUPLICATE **", width), bold(false));
  }
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
        pushWrappedLine(b, `${item.quantity}x ${item.name}${note}`, width, "  ");
      }
    }
  } else {
    for (const item of items || []) {
      const note = item.specialRequest ? ` (${item.specialRequest})` : "";
      const server = item.servedByName ? ` [${item.servedByName}]` : "";
      pushWrappedLine(b, `${item.quantity}x ${item.name}${server}${note}`, width);
    }
  }
  b.push(line(width));
  b.push(ln(`Encoder: ${encoder || ""}`, width));
  b.push(ln("", width), ln("", width), ln("", width));
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
    const label = cleanText(`${item.quantity}x ${item.name}${server}${note}`);
    const labelWidth = Math.max(1, width - price.length - 1);
    const wrappedLabel = wrapText(label, labelWidth);
    const lastLine = wrappedLabel.pop() || "";
    for (const part of wrappedLabel) {
      b.push(ln(part, width));
    }
    const pad = Math.max(1, width - lastLine.length - price.length);
    b.push(ln(lastLine + " ".repeat(pad) + price, width));
  }
  b.push(line(width));
  const subStr = `P${Number(subtotal).toFixed(2)}`;
  const subPad = Math.max(1, width - "SUBTOTAL:".length - subStr.length);
  b.push(bold(true), ln("SUBTOTAL:" + " ".repeat(subPad) + subStr, width), bold(false));
  b.push(align(1));
  b.push(ln("Not official receipt.", width));
  b.push(ln("Subject to tax & service charge.", width));
  b.push(ln("Signature: ____________________", width));
  b.push(ln("", width), ln("", width), ln("", width));
  b.push(cut());
  return Buffer.concat(b);
}

function buildRunningBill({ businessName: bName, businessAddress: bAddr, date, time, table: tableStr, cashier, orderIds, items, subtotal, complimentary, discount, discountName, serviceCharge, serviceLabel, tax, taxLabel, cardSurcharge, total }, width = 48) {
  const businessName = cleanText(bName);
  const businessAddress = cleanText(bAddr);
  const b = [init(), align(1), bold(true), sizeLarge()];
  if (businessName) b.push(ln(businessName, width));
  b.push(sizeNormal(), bold(false));
  if (businessAddress) b.push(ln(businessAddress, width));
  b.push(line(width));
  b.push(bold(true), ln("BILL SUMMARY", width), bold(false));
  b.push(ln("NOT OFFICIAL RECEIPT", width));
  b.push(line(width));
  b.push(align(0));
  b.push(ln(`Date: ${date || ""}`, width));
  b.push(ln(`Time: ${time || ""}`, width));
  b.push(ln(`Table: ${tableStr || ""}`, width));
  b.push(ln(`Cashier: ${cashier || ""}`, width));
  if (orderIds) b.push(ln(`Orders: ${orderIds}`, width));
  b.push(line(width));
  b.push(bold(true), ln("ITEMS", width), bold(false));
  for (const item of items || []) {
    const suffix = [
      item.department === "LD" && item.servedByName ? ` [${item.servedByName}]` : "",
      item.isComplimentary ? " (Compli)" : "",
      item.specialRequest ? ` - ${item.specialRequest}` : "",
    ].join("");
    const label = cleanText(`${item.quantity}x ${item.name}${suffix}`);
    const priceStr = `P${Number(item.subtotal).toFixed(2)}`;
    const nameWidth = Math.max(1, width - priceStr.length - 1);
    const wrapped = wrapText(label, nameWidth);
    const lastLine = wrapped.pop() || "";
    for (const part of wrapped) b.push(ln(part, width));
    const pad = Math.max(1, width - lastLine.length - priceStr.length);
    b.push(ln(lastLine + " ".repeat(pad) + priceStr, width));
  }
  b.push(line(width));
  const pl = (label, val) => {
    const v = String(val);
    const pad = Math.max(1, width - label.length - v.length);
    b.push(ln(label + " ".repeat(pad) + v, width));
  };
  pl("Subtotal:", `P${Number(subtotal).toFixed(2)}`);
  if (complimentary) pl("Less Compli:", `-P${Number(complimentary).toFixed(2)}`);
  if (discount) pl(`Discount${discountName ? ` (${discountName})` : ""}:`, `-P${Number(discount).toFixed(2)}`);
  pl(`${serviceLabel || "Service:"}`, `P${Number(serviceCharge).toFixed(2)}`);
  pl(`${taxLabel || "Tax:"}`, `P${Number(tax).toFixed(2)}`);
  if (cardSurcharge) pl("Card Fee:", `P${Number(cardSurcharge).toFixed(2)}`);
  b.push(line(width));
  b.push(bold(true));
  pl("TOTAL DUE:", `P${Number(total).toFixed(2)}`);
  b.push(bold(false));
  b.push(line(width));
  b.push(align(1));
  b.push(ln("For bill checking before payment only.", width));
  b.push(ln("", width), ln("", width), ln("", width), ln("", width));
  b.push(cut());
  return Buffer.concat(b);
}

function sumPayslipBreakdown(breakdown) {
  if (!Array.isArray(breakdown)) return 0;
  return breakdown.reduce((s, x) => s + Number(x.amount || 0), 0);
}

function payslipIncentiveLinesFromPayload(p) {
  const lines = [];
  if (Number(p.incentives) > 0) lines.push({ label: "LD Incentives", amount: Number(p.incentives) });
  if (Array.isArray(p.incentivesBreakdown)) {
    for (const item of p.incentivesBreakdown) {
      lines.push({ label: String(item.title || "Incentive"), amount: Number(item.amount || 0) });
    }
  }
  return lines;
}

function payslipAdjustmentLinesFromPayload(p) {
  if (Array.isArray(p.adjustmentsBreakdown) && p.adjustmentsBreakdown.length > 0) {
    return p.adjustmentsBreakdown.map((item) => ({
      label: String(item.title || "Adjustment"),
      amount: Number(item.amount || 0),
    }));
  }
  if (Number(p.adjustments) !== 0) return [{ label: "Adjustments", amount: Number(p.adjustments) }];
  return [];
}

function payslipDeductionLinesFromPayload(p) {
  if (Array.isArray(p.deductionsBreakdown) && p.deductionsBreakdown.length > 0) {
    return p.deductionsBreakdown.map((item) => ({
      label: String(item.title || "Deduction"),
      amount: Number(item.amount || 0),
    }));
  }
  if (Number(p.deductions) > 0) return [{ label: "Deductions", amount: Number(p.deductions) }];
  return [];
}

function pushPayslipGroup(b, width, pl, title, lines, total) {
  b.push(bold(true), ln(title, width), bold(false));
  const items = lines.length > 0 ? lines : [{ label: "—", amount: 0 }];
  for (const item of items) {
    const label = `${String(item.label || "").slice(0, 28)}:`;
    pl(label, `P${Number(item.amount || 0).toFixed(2)}`);
  }
  b.push(bold(true));
  pl("Total:", `P${Number(total || 0).toFixed(2)}`);
  b.push(bold(false));
}

function buildPayslip(payslip, width = 48) {
  const p = payslip || {};
  const pl = (label, val) => {
    const v = String(val);
    const pad = Math.max(1, width - label.length - v.length);
    return ln(label + " ".repeat(pad) + v, width);
  };
  const incentiveLines = payslipIncentiveLinesFromPayload(p);
  const incentiveTotal = Number(p.incentives ?? 0) + sumPayslipBreakdown(p.incentivesBreakdown);
  const adjustmentLines = payslipAdjustmentLinesFromPayload(p);
  const adjustmentTotal =
    Array.isArray(p.adjustmentsBreakdown) && p.adjustmentsBreakdown.length > 0
      ? sumPayslipBreakdown(p.adjustmentsBreakdown)
      : Number(p.adjustments ?? 0);
  const deductionLines = payslipDeductionLinesFromPayload(p);
  const deductionTotal =
    Array.isArray(p.deductionsBreakdown) && p.deductionsBreakdown.length > 0
      ? sumPayslipBreakdown(p.deductionsBreakdown)
      : Number(p.deductions ?? 0);

  const b = [
    init(),
    align(1),
    bold(true),
    ln("RABBIT ALLEY", width),
    bold(false),
    ln("Bar & Restaurant", width),
    ln("PAYSLIP RECEIPT", width),
    line(width),
    align(0),
    bold(true),
    ln("EMPLOYEE", width),
    bold(false),
    pl("Name:", cleanText(String(p.name || "").slice(0, 24))),
    pl("Employee No:", p.employeeId || ""),
    pl("Period:", `${p.periodFrom || ""} - ${p.periodTo || ""}`),
    line(width),
    bold(true),
    ln("EARNINGS", width),
    bold(false),
    pl("Budget:", `P${Number(p.allowance ?? 0).toFixed(2)}`),
    pl("LD count (incl. open):", String(p.ldCount ?? 0)),
    pl("Commission:", `P${Number(p.commission ?? 0).toFixed(2)}`),
    line(width),
  ];
  pushPayslipGroup(b, width, pl, "INCENTIVES", incentiveLines, incentiveTotal);
  b.push(line(width));
  pushPayslipGroup(b, width, pl, "ADJUSTMENTS", adjustmentLines, adjustmentTotal);
  b.push(line(width));
  pushPayslipGroup(b, width, pl, "DEDUCTIONS", deductionLines, deductionTotal);
  b.push(
    line(width),
    bold(true),
    pl("Total payout:", `P${Number(p.netPayout ?? 0).toFixed(2)}`),
    bold(false),
    line(width),
    align(1),
    ln(`Status: ${String(p.status || "draft").toUpperCase()}`, width)
  );
  if (p.approvedBy) b.push(ln(`Approved: ${cleanText(p.approvedBy)}`, width));
  b.push(
    ln("", width),
    ln("Received by: _____________________", width),
    ln("", width),
    ln("This is a computer-generated payslip.", width),
    ln("", width),
    ln("", width),
    ln("", width),
    cut()
  );
  return Buffer.concat(b);
}

export { buildCustomerReceipt, buildDeptChit, buildOrderSlip, buildRunningBill, buildPayslip };
