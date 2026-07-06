/** Single source of truth for all localStorage key names used across the app. */
export const STORAGE_USER = "pos_user";
export const STORAGE_PERMISSIONS = "pos_permissions";
export const STORAGE_AUTH_TOKEN = "pos_auth_token";
export const POS_SETTINGS_STORAGE_KEY = "pos_runtime_settings";

/** Legacy keys — kept for one-time migration into PRINT_JOB_ASSIGNMENTS_KEY. */
export const RECEIPT_PRINTER_STORAGE_KEY = "pos_receipt_printer";
export const RECEIPT_PRINTERS_BY_AREA_KEY = "pos_receipt_printers_by_area";
export const DEPT_PRINTERS_KEY = "pos_dept_printers";

/** Per print-job-type printer assignments. Value: JSON object keyed by PrintJobType. */
export const PRINT_JOB_ASSIGNMENTS_KEY = "pos_printer_assignments";
/** DB `settings.setting_key` for the same JSON payload. */
export const PRINT_JOB_ASSIGNMENTS_SETTING_KEY = "printer_assignments";

/** When "1", customer receipt & dept chits print via QZ Tray (this PC) instead of server LAN. */
export const QZ_TRAY_ENABLED_KEY = "pos_qz_tray_enabled";

export const POS_AREAS = ["Lounge", "Club", "LD"] as const;
export type PosArea = (typeof POS_AREAS)[number];

export const POS_DEPTS = ["Bar", "Kitchen", "LD"] as const;
export type PosDept = (typeof POS_DEPTS)[number];

/** Print job types — any printer may be assigned to any type (no area rules). */
export const PRINT_JOB_TYPES = [
  "payment_receipt",
  "running_bill",
  "order_slip",
  "bar_chit",
  "kitchen_chit",
  "ld_chit",
] as const;

export type PrintJobType = (typeof PRINT_JOB_TYPES)[number];

export type PrinterAssignments = Record<PrintJobType, string>;

export const PRINT_JOB_LABELS: Record<PrintJobType, string> = {
  payment_receipt: "Payment receipt",
  running_bill: "Running bill",
  order_slip: "Order slip",
  bar_chit: "Bar chit",
  kitchen_chit: "Kitchen chit",
  ld_chit: "LD chit",
};

/** Short purpose text for the footer helper line (order matches the two-column grid). */
export const PRINT_JOB_HELPER =
  "Official receipt after payment or reprint · Bill summary before payment · Cashier copy when an order is sent · Drink orders sent to bar · Food orders sent to kitchen · Orders sent to LD station";

export function emptyPrinterAssignments(): PrinterAssignments {
  return {
    payment_receipt: "",
    running_bill: "",
    order_slip: "",
    bar_chit: "",
    kitchen_chit: "",
    ld_chit: "",
  };
}

function normalizeAssignments(raw: unknown): PrinterAssignments {
  const base = emptyPrinterAssignments();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  for (const key of PRINT_JOB_TYPES) {
    const v = obj[key];
    base[key] = typeof v === "string" ? v.trim() : "";
  }
  return base;
}

/** Migrate legacy area/dept localStorage keys into print-job-type assignments. */
function migrateLegacyAssignments(): PrinterAssignments | null {
  try {
    let receiptFallback = "";
    const byAreaRaw = localStorage.getItem(RECEIPT_PRINTERS_BY_AREA_KEY);
    if (byAreaRaw) {
      const p = JSON.parse(byAreaRaw) as Record<string, string>;
      receiptFallback = (p.Lounge || p.Club || p.LD || "").trim();
    }
    if (!receiptFallback) {
      receiptFallback = (localStorage.getItem(RECEIPT_PRINTER_STORAGE_KEY) || "").trim();
    }

    let bar = "";
    let kitchen = "";
    let ld = "";
    const deptRaw = localStorage.getItem(DEPT_PRINTERS_KEY);
    if (deptRaw) {
      const p = JSON.parse(deptRaw) as Record<string, string>;
      bar = (p.Bar || "").trim();
      kitchen = (p.Kitchen || "").trim();
      ld = (p.LD || "").trim();
    }

    if (!receiptFallback && !bar && !kitchen && !ld) return null;

    return {
      payment_receipt: receiptFallback,
      running_bill: receiptFallback,
      order_slip: receiptFallback,
      bar_chit: bar,
      kitchen_chit: kitchen,
      ld_chit: ld,
    };
  } catch {
    return null;
  }
}

export function parsePrinterAssignments(): PrinterAssignments {
  try {
    const raw = localStorage.getItem(PRINT_JOB_ASSIGNMENTS_KEY);
    if (raw) return normalizeAssignments(JSON.parse(raw));
  } catch {
    // fall through to migration
  }
  const migrated = migrateLegacyAssignments();
  if (migrated) {
    savePrinterAssignmentsLocal(migrated);
    return migrated;
  }
  return emptyPrinterAssignments();
}

export function savePrinterAssignmentsLocal(assignments: PrinterAssignments): void {
  localStorage.setItem(PRINT_JOB_ASSIGNMENTS_KEY, JSON.stringify(normalizeAssignments(assignments)));
}

/** Apply a JSON string (or object) from the settings API into localStorage. */
export function applyPrinterAssignmentsFromSetting(value: string | unknown): PrinterAssignments {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = null;
    }
  }
  const assignments = normalizeAssignments(parsed);
  savePrinterAssignmentsLocal(assignments);
  return assignments;
}

/** Printer name for a print job type, or null when set to None / unassigned. */
export function getPrinterForJob(type: PrintJobType): string | null {
  const value = parsePrinterAssignments()[type];
  return value && value.trim() ? value.trim() : null;
}

/** Map department title/key to the chit print job type. */
export function deptToPrintJobType(dept: string | undefined): PrintJobType | null {
  if (!dept) return null;
  const d = dept.trim().toLowerCase();
  if (d === "bar") return "bar_chit";
  if (d === "kitchen") return "kitchen_chit";
  if (d === "ld") return "ld_chit";
  return null;
}

/** @deprecated Prefer getPrinterForJob("payment_receipt" | "running_bill" | "order_slip"). */
export function getReceiptPrinterForArea(_area: string | undefined): string | null {
  return getPrinterForJob("payment_receipt");
}

/** @deprecated Prefer getPrinterForJob via deptToPrintJobType. */
export function getDeptPrinter(dept: string | undefined): string | null {
  const job = deptToPrintJobType(dept);
  return job ? getPrinterForJob(job) : null;
}

type PrinterOptionLike = { name: string; displayName?: string };

/**
 * Auto-assign unassigned print types using name/location hints, else the first available printer.
 * Does not overwrite types that already have a printer.
 */
export function autoAssignPrinters(
  current: PrinterAssignments,
  printers: PrinterOptionLike[]
): PrinterAssignments {
  if (printers.length === 0) return { ...current };

  const haystack = (p: PrinterOptionLike) =>
    `${p.name} ${p.displayName || ""}`.toLowerCase();

  const findByHints = (hints: RegExp[]): string | null => {
    for (const hint of hints) {
      const match = printers.find((p) => hint.test(haystack(p)));
      if (match) return match.name;
    }
    return null;
  };

  const first = printers[0].name;
  const next = { ...current };

  const rules: Record<PrintJobType, RegExp[]> = {
    payment_receipt: [/receipt/, /cashier/, /pos/, /front/, /counter/],
    running_bill: [/receipt/, /cashier/, /pos/, /bill/, /front/, /counter/],
    order_slip: [/receipt/, /cashier/, /pos/, /slip/, /front/, /counter/],
    bar_chit: [/\bbar\b/, /beverage/, /drink/],
    kitchen_chit: [/kitchen/, /cook/, /food/, /chef/],
    ld_chit: [/\bld\b/, /lounge/, /vip/],
  };

  for (const type of PRINT_JOB_TYPES) {
    if (next[type]?.trim()) continue;
    next[type] = findByHints(rules[type]) || first;
  }

  return next;
}
