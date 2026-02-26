import { POS_SETTINGS_STORAGE_KEY } from "@/lib/storage-keys";
export { POS_SETTINGS_STORAGE_KEY };

export interface PosRuntimeSettings {
  businessName: string;
  address: string;
  contact: string;
  receiptFooter: string;
  taxRate: number;
  serviceChargeMode: "percent" | "fixed";
  serviceChargeValue: number;
  cardSurcharge: number;
}

export const DEFAULT_POS_SETTINGS: PosRuntimeSettings = {
  businessName: "Rabbit Alley",
  address: "123 Main Street, Manila, Philippines",
  contact: "+63 912 345 6789",
  receiptFooter: "Thank you for visiting Rabbit Alley!",
  taxRate: 12,
  serviceChargeMode: "percent",
  serviceChargeValue: 10,
  cardSurcharge: 2,
};

function clampNumber(value: unknown, fallback: number, min = 0, max = 1000) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function sanitizeSettings(raw: Partial<PosRuntimeSettings> | null | undefined): PosRuntimeSettings {
  return {
    businessName: (raw?.businessName || DEFAULT_POS_SETTINGS.businessName).toString(),
    address: (raw?.address || DEFAULT_POS_SETTINGS.address).toString(),
    contact: (raw?.contact || DEFAULT_POS_SETTINGS.contact).toString(),
    receiptFooter: (raw?.receiptFooter || DEFAULT_POS_SETTINGS.receiptFooter).toString(),
    taxRate: clampNumber(raw?.taxRate, DEFAULT_POS_SETTINGS.taxRate, 0, 100),
    serviceChargeMode: raw?.serviceChargeMode === "fixed" ? "fixed" : "percent",
    serviceChargeValue: clampNumber(raw?.serviceChargeValue, DEFAULT_POS_SETTINGS.serviceChargeValue, 0, 1000000),
    cardSurcharge: clampNumber(raw?.cardSurcharge, DEFAULT_POS_SETTINGS.cardSurcharge, 0, 100),
  };
}

export function getPosSettings(): PosRuntimeSettings {
  if (typeof window === "undefined") return DEFAULT_POS_SETTINGS;
  try {
    const raw = localStorage.getItem(POS_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_POS_SETTINGS;
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_POS_SETTINGS;
  }
}

export function savePosSettings(settings: Partial<PosRuntimeSettings>) {
  if (typeof window === "undefined") return;
  const merged = sanitizeSettings({ ...getPosSettings(), ...settings });
  localStorage.setItem(POS_SETTINGS_STORAGE_KEY, JSON.stringify(merged));
}

