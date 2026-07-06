function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMoney(n) {
  return `₱${Number(n || 0).toFixed(2)}`;
}

function buildCustomerReceiptHtml(receipt) {
  const isReprint =
    receipt.isReprint === true ||
    receipt.isReprint === 1 ||
    receipt.isReprint === "1" ||
    /^reprint/i.test(String(receipt.paymentMethod || ""));
  const payMethodRaw =
    isReprint && /^reprint/i.test(String(receipt.paymentMethod || ""))
      ? receipt.originalPaymentMethod || receipt.paymentMethodOriginal || null
      : receipt.paymentMethod;
  const payLabel =
    payMethodRaw && !/^reprint/i.test(String(payMethodRaw))
      ? String(payMethodRaw).toUpperCase()
      : isReprint
        ? "—"
        : "CASH";
  const itemRows = (receipt.items || [])
    .map((item) => {
      const note = item.note ?? item.specialRequest ?? item.comment;
      const noteSuffix = note ? ` <span class="note">(${escapeHtml(note)})</span>` : "";
      return `<tr>
        <td>${escapeHtml(item.quantity)}x ${escapeHtml(item.name)}${noteSuffix}</td>
        <td class="num">${item.subtotal === 0 ? "0.00" : formatMoney(item.subtotal)}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${escapeHtml(receipt.orderNumber || "")}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm 2mm 8mm 2mm; }
    body { font-family: 'Courier New', monospace; font-size: 11px; width: 76mm; margin: 0 auto; padding: 6px 4px; color: #000; }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .line { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; gap: 6px; margin: 2px 0; }
    .row.total { font-weight: 700; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 4px 0; }
    td { padding: 2px 0; vertical-align: top; }
    td.num { text-align: right; white-space: nowrap; }
    .note { font-size: 10px; color: #444; }
    .reprint { font-weight: 700; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="center">
    ${receipt.businessName ? `<div class="bold" style="font-size:14px;">${escapeHtml(receipt.businessName)}</div>` : ""}
    ${receipt.businessAddress ? `<div>${escapeHtml(receipt.businessAddress)}</div>` : ""}
    ${receipt.businessContact ? `<div>${escapeHtml(receipt.businessContact)}</div>` : ""}
    <div class="line"></div>
    ${isReprint ? `<div class="reprint">** REPRINT COPY **</div>` : ""}
    <div class="line"></div>
  </div>
  <div>Order: ${escapeHtml(receipt.orderNumber)}</div>
  <div>Date: ${escapeHtml(receipt.date)} ${escapeHtml(receipt.time)}</div>
  <div>Table: ${escapeHtml(receipt.table)}</div>
  <div>Cashier: ${escapeHtml(receipt.cashier)}</div>
  <div class="line"></div>
  <div class="bold">ITEMS</div>
  <table><tbody>${itemRows}</tbody></table>
  <div class="line"></div>
  <div class="row"><span>Subtotal</span><span>${formatMoney(receipt.subtotal)}</span></div>
  ${receipt.complimentary ? `<div class="row"><span>Less Compli</span><span>-${formatMoney(receipt.complimentary)}</span></div>` : ""}
  ${receipt.discount ? `<div class="row"><span>Discount</span><span>-${formatMoney(receipt.discount)}</span></div>` : ""}
  <div class="row"><span>${escapeHtml(receipt.serviceLabel || "Service")}</span><span>${formatMoney(receipt.serviceCharge)}</span></div>
  <div class="row"><span>${escapeHtml(receipt.taxLabel || "Tax")}</span><span>${formatMoney(receipt.tax)}</span></div>
  ${receipt.cardSurcharge ? `<div class="row"><span>Card Fee</span><span>${formatMoney(receipt.cardSurcharge)}</span></div>` : ""}
  <div class="line"></div>
  <div class="row total"><span>TOTAL</span><span>${formatMoney(receipt.total)}</span></div>
  <div class="line"></div>
  <div class="row"><span>Payment</span><span>${escapeHtml(payLabel)}</span></div>
  <div class="row"><span>Amount Paid</span><span>${formatMoney(receipt.amountPaid)}</span></div>
  <div class="row"><span>Change</span><span>${formatMoney(receipt.change)}</span></div>
  <div class="center" style="margin-top:8px;">
    ${receipt.receiptFooter ? `<div class="bold">${escapeHtml(receipt.receiptFooter)}</div>` : ""}
    <div>Please come again</div>
    <div>This serves as your OFFICIAL RECEIPT</div>
    ${receipt.vatTin ? `<div>VAT Reg TIN: ${escapeHtml(receipt.vatTin)}</div>` : ""}
    ${isReprint ? `<div class="reprint">** REPRINT — NOT A DUPLICATE **</div>` : ""}
  </div>
</body>
</html>`;
}

function buildRunningBillHtml(body) {
  const itemRows = (body.items || [])
    .map((item) => {
      const suffix = [
        item.department === "LD" && item.servedByName ? ` [${escapeHtml(item.servedByName)}]` : "",
        item.isComplimentary ? " (Compli)" : "",
        item.specialRequest ? ` - ${escapeHtml(item.specialRequest)}` : "",
      ].join("");
      return `<tr><td>${escapeHtml(item.quantity)}x ${escapeHtml(item.name)}${suffix}</td><td class="num">${formatMoney(item.subtotal)}</td></tr>`;
    })
    .join("");

  const discountLabel = body.discountName
    ? `Discount (${escapeHtml(body.discountName)})`
    : "Discount";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bill Summary</title>
  <style>
    @page { size: 80mm auto; margin: 3mm 2mm 8mm 2mm; }
    body { font-family: 'Courier New', monospace; font-size: 11px; width: 76mm; margin: 0 auto; padding: 6px 4px; }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .line { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    .row.total { font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin: 4px 0; }
    td.num { text-align: right; }
    .note { font-size: 10px; color: #555; margin-top: 6px; }
  </style>
</head>
<body>
  <div class="center">
    ${body.businessName ? `<div class="bold">${escapeHtml(body.businessName)}</div>` : ""}
    <div class="bold">BILL SUMMARY</div>
    <div class="note">NOT OFFICIAL RECEIPT</div>
    <div class="line"></div>
  </div>
  <div>Date: ${escapeHtml(body.date)} ${escapeHtml(body.time)}</div>
  <div>Table: ${escapeHtml(body.table)}</div>
  <div>Cashier: ${escapeHtml(body.cashier)}</div>
  ${body.orderIds ? `<div>Orders: ${escapeHtml(body.orderIds)}</div>` : ""}
  <div class="line"></div>
  <div class="bold">ITEMS</div>
  <table><tbody>${itemRows}</tbody></table>
  <div class="line"></div>
  <div class="row"><span>Subtotal</span><span>${formatMoney(body.subtotal)}</span></div>
  ${body.complimentary ? `<div class="row"><span>Less Compli</span><span>-${formatMoney(body.complimentary)}</span></div>` : ""}
  ${body.discount ? `<div class="row"><span>${escapeHtml(discountLabel)}</span><span>-${formatMoney(body.discount)}</span></div>` : ""}
  <div class="row"><span>${escapeHtml(body.serviceLabel || "Service")}</span><span>${formatMoney(body.serviceCharge)}</span></div>
  <div class="row"><span>${escapeHtml(body.taxLabel || "Tax")}</span><span>${formatMoney(body.tax)}</span></div>
  ${body.cardSurcharge ? `<div class="row"><span>Card Fee</span><span>${formatMoney(body.cardSurcharge)}</span></div>` : ""}
  <div class="line"></div>
  <div class="row total"><span>TOTAL DUE</span><span>${formatMoney(body.total)}</span></div>
  <div class="note center">For bill checking before payment only.</div>
</body>
</html>`;
}

export { escapeHtml, buildCustomerReceiptHtml, buildRunningBillHtml };
