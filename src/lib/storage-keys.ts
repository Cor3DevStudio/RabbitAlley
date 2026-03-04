/** Single source of truth for all localStorage key names used across the app. */
export const STORAGE_USER = "pos_user";
export const STORAGE_PERMISSIONS = "pos_permissions";
export const POS_SETTINGS_STORAGE_KEY = "pos_runtime_settings";
export const RECEIPT_PRINTER_STORAGE_KEY = "pos_receipt_printer";
/** Per-area receipt printers (Lounge, Club, LD). Value: JSON object { Lounge?: string, Club?: string, LD?: string }. */
export const RECEIPT_PRINTERS_BY_AREA_KEY = "pos_receipt_printers_by_area";

export const POS_AREAS = ["Lounge", "Club", "LD"] as const;
export type PosArea = (typeof POS_AREAS)[number];

export type ReceiptPrintersByArea = Partial<Record<PosArea, string>>;

function parsePrintersByArea(): ReceiptPrintersByArea {
  try {
    const raw = localStorage.getItem(RECEIPT_PRINTERS_BY_AREA_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return { Lounge: parsed.Lounge ?? "", Club: parsed.Club ?? "", LD: parsed.LD ?? "" };
  } catch {
    return {};
  }
}

/** Get the receipt printer name for an area. Falls back to single RECEIPT_PRINTER_STORAGE_KEY if no per-area set. */
export function getReceiptPrinterForArea(area: string | undefined): string | null {
  if (!area) return null;
  const byArea = parsePrintersByArea();
  const value = byArea[area as PosArea];
  if (value && value.trim()) return value.trim();
  return localStorage.getItem(RECEIPT_PRINTER_STORAGE_KEY);
}

// ── Department (chit) printers: BAR, KITCHEN, LD ─────────────────────────────
/** Per-dept chit printers. Value: JSON object { Bar?: string, Kitchen?: string, LD?: string }. */
export const DEPT_PRINTERS_KEY = "pos_dept_printers";

export const POS_DEPTS = ["Bar", "Kitchen", "LD"] as const;
export type PosDept = (typeof POS_DEPTS)[number];

export type DeptPrinters = Partial<Record<PosDept, string>>;

function parseDeptPrinters(): DeptPrinters {
  try {
    const raw = localStorage.getItem(DEPT_PRINTERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return { Bar: parsed.Bar ?? "", Kitchen: parsed.Kitchen ?? "", LD: parsed.LD ?? "" };
  } catch {
    return {};
  }
}

/** Get the chit printer for a department (Bar, Kitchen, LD). Returns null if not set. */
export function getDeptPrinter(dept: string | undefined): string | null {
  if (!dept) return null;
  const p = parseDeptPrinters();
  const value = p[dept as PosDept];
  return value && value.trim() ? value.trim() : null;
}
