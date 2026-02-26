/**
 * Direct thermal receipt print — run from command line.
 * Sends ESC/POS to the printer via PRINTER_INTERFACE (tcp://IP:9100).
 *
 * Usage:
 *   npm run print-receipt              Print a test receipt
 *   npm run print-receipt -- receipt.json   Print receipt from JSON file
 *
 * Requires in server/.env:
 *   PRINTER_INTERFACE=tcp://192.168.1.100:9100   (your thermal printer's IP)
 *
 * Does not work with printer:Name (USB); use network/IP or browser print.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ThermalPrinter from "node-thermal-printer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PRINTER_INTERFACE = process.env.PRINTER_INTERFACE || "";
const PRINTER_TIMEOUT = Math.max(3000, Number(process.env.PRINTER_TIMEOUT) || 10000);

if (!PRINTER_INTERFACE || !PRINTER_INTERFACE.toLowerCase().startsWith("tcp://")) {
  console.error("This command only works with a printer that has an IP address (Ethernet or Wi‑Fi).");
  console.error("");
  console.error("Why not USB? From the command line we send raw data over the network (tcp://IP:9100).");
  console.error("USB printers are handled by Windows; this app doesn’t talk to them from Node, so we use");
  console.error("the POS «Print receipt» button and you choose your USB printer (e.g. XP-80C) in the browser.");
  console.error("");
  console.error("If your thermal printer has Ethernet: in server/.env set:");
  console.error("  PRINTER_INTERFACE=tcp://PRINTER_IP:9100");
  console.error("Then run: npm run print-receipt");
  process.exit(1);
}

function buildReceipt(printer, data) {
  const printLine = (label, value) => {
    const padding = 48 - label.length - value.length;
    printer.println(label + " ".repeat(Math.max(1, padding)) + value);
  };

  printer.alignCenter();
  printer.bold(true);
  printer.setTextSize(1, 1);
  printer.println("RABBIT ALLEY");
  printer.bold(false);
  printer.setTextNormal();
  printer.println("Bar & Restaurant");
  printer.println("123 Main Street, City");
  printer.println("Tel: (02) 123-4567");
  printer.drawLine();

  printer.alignLeft();
  printer.println(`Order #: ${data.orderNumber}`);
  printer.println(`Date: ${data.date}`);
  printer.println(`Time: ${data.time}`);
  printer.println(`Table: ${data.table}`);
  printer.println(`Cashier: ${data.cashier}`);
  printer.drawLine();

  printer.bold(true);
  printer.println("ITEMS");
  printer.bold(false);
  for (const item of data.items || []) {
    const itemLine = `${item.quantity}x ${item.name}`;
    const priceLine = `P${Number(item.subtotal).toFixed(2)}`;
    const padding = 48 - itemLine.length - priceLine.length;
    printer.println(itemLine + " ".repeat(Math.max(1, padding)) + priceLine);
  }
  printer.drawLine();

  printLine("Subtotal:", `P${Number(data.subtotal).toFixed(2)}`);
  if (data.complimentary) printLine("Less Compli:", `-P${Number(data.complimentary).toFixed(2)}`);
  if (data.discount) printLine("Discount:", `-P${Number(data.discount).toFixed(2)}`);
  printLine("Service (10%):", `P${Number(data.serviceCharge).toFixed(2)}`);
  printLine("VAT (12%):", `P${Number(data.tax).toFixed(2)}`);
  if (data.cardSurcharge) printLine("Card Fee (4%):", `P${Number(data.cardSurcharge).toFixed(2)}`);
  printer.drawLine();
  printer.bold(true);
  printLine("TOTAL:", `P${Number(data.total).toFixed(2)}`);
  printer.bold(false);
  printer.drawLine();

  printLine("Payment:", (data.paymentMethod || "CASH").toUpperCase());
  printLine("Amount Paid:", `P${Number(data.amountPaid).toFixed(2)}`);
  printLine("Change:", `P${Number(data.change).toFixed(2)}`);
  printer.drawLine();

  printer.alignCenter();
  printer.println("");
  printer.bold(true);
  printer.println("Thank you for dining with us!");
  printer.bold(false);
  printer.println("Please come again");
  printer.println("");
  printer.println("This serves as your OFFICIAL RECEIPT");
  printer.println("VAT Reg TIN: 123-456-789-000");
  printer.println("");
  printer.cut();
}

async function main() {
  const jsonPath = process.argv[2];
  let receiptData;

  if (jsonPath && fs.existsSync(jsonPath)) {
    const raw = fs.readFileSync(jsonPath, "utf8");
    receiptData = JSON.parse(raw);
    if (!receiptData.orderNumber) receiptData.orderNumber = "FILE";
    if (!receiptData.date) receiptData.date = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    if (!receiptData.time) receiptData.time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    if (!receiptData.table) receiptData.table = "-";
    if (!receiptData.cashier) receiptData.cashier = "Staff";
    if (!receiptData.items) receiptData.items = [];
    if (receiptData.subtotal == null) receiptData.subtotal = 0;
    if (receiptData.serviceCharge == null) receiptData.serviceCharge = 0;
    if (receiptData.tax == null) receiptData.tax = 0;
    if (receiptData.total == null) receiptData.total = 0;
    if (receiptData.amountPaid == null) receiptData.amountPaid = receiptData.total;
    if (receiptData.change == null) receiptData.change = 0;
    console.log("Printing receipt from", path.basename(jsonPath));
  } else {
    const now = new Date();
    receiptData = {
      orderNumber: "TEST",
      date: now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      table: "Direct Print Test",
      cashier: "Script",
      items: [{ name: "Test Item", quantity: 1, subtotal: 100 }],
      subtotal: 100,
      serviceCharge: 10,
      tax: 12,
      total: 122,
      paymentMethod: "CASH",
      amountPaid: 122,
      change: 0,
    };
    console.log("Printing test receipt to", PRINTER_INTERFACE);
  }

  const printer = new ThermalPrinter.printer({
    type: ThermalPrinter.types.EPSON,
    interface: PRINTER_INTERFACE,
    options: { timeout: PRINTER_TIMEOUT },
    characterSet: "PC437_USA",
    removeSpecialCharacters: false,
    lineCharacter: "-",
    width: 48,
  });

  buildReceipt(printer, receiptData);
  await printer.execute();
  console.log("Done. Receipt sent to printer.");
}

main().catch((err) => {
  console.error("Print failed:", err.message);
  process.exit(1);
});
