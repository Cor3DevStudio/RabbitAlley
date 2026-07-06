import ThermalPrinter from "node-thermal-printer";

/** Resolve printer interface from request body name or env default. */
export function resolvePrinterInterface(printerName, defaultFromEnv) {
  const usePrinterName = typeof printerName === "string" && printerName.trim() ? printerName.trim() : null;
  if (!usePrinterName) return defaultFromEnv;
  const lower = usePrinterName.toLowerCase();
  if (lower.startsWith("tcp://") || lower.startsWith("socket://")) return usePrinterName;
  return `printer:${usePrinterName}`;
}

const PRINTER_TYPES_MAP = {
  epson: ThermalPrinter.types.EPSON,
  star: ThermalPrinter.types.STAR,
  brother: ThermalPrinter.types.BROTHER,
  daruma: ThermalPrinter.types.DARUMA,
  tanca: ThermalPrinter.types.TANCA,
  custom: ThermalPrinter.types.CUSTOM,
};

/**
 * Send raw ESC/POS buffer to a thermal printer (Ethernet or Windows spooler).
 */
export async function printEscPosBuffer(buffer, options = {}) {
  const {
    printerType = "epson",
    printerInterface,
    driver = null,
    printerOptions = { timeout: 10000 },
    width = 48,
  } = options;

  const type = PRINTER_TYPES_MAP[String(printerType || "epson").toLowerCase()] || ThermalPrinter.types.EPSON;
  const iface = printerInterface;
  if (!iface) {
    return { ok: false, error: "No printer configured.", fallback: true };
  }

  const needDriver = String(iface).toLowerCase().startsWith("printer:");
  if (needDriver && !driver) {
    return {
      ok: false,
      error: "Automatic print requires Node 18 or 20 and: npm install printer --legacy-peer-deps. Or select a printer in Settings.",
      fallback: true,
    };
  }

  const printer = new ThermalPrinter.printer({
    type,
    interface: iface,
    driver: driver || undefined,
    options: printerOptions,
    characterSet: "PC437_USA",
    removeSpecialCharacters: false,
    lineCharacter: "-",
    width,
  });

  try {
    const connected = await printer.isPrinterConnected();
    if (!connected && process.env.PRINTER_INTERFACE) {
      console.warn("Printer not connected, attempting to print anyway...");
    }
    printer.setBuffer(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
    await printer.execute();
    return { ok: true, message: "Printed" };
  } catch (err) {
    const isTimeout = /timeout|ETIMEDOUT/i.test(String(err.message));
    return {
      ok: false,
      error: err.message,
      fallback: true,
    };
  }
}
