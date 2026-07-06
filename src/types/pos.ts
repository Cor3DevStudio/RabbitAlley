// POS shared types

export interface Table {
  id: string;
  name: string;
  area: "Lounge" | "Club" | "LD";
  status: "available" | "occupied";
  currentOrderId?: string;
  /** Set when a floor waiter has opened/claimed this table (until payment). */
  lockedByEmployeeId?: string;
  lockedByName?: string;
}

export const areas = ["Lounge", "Club", "LD"] as const;
export type Area = (typeof areas)[number];

/** One sellable price under a product/SKU (inventory identity stays on Product.sku). */
export interface ProductPrice {
  id?: string | null;
  label: string;
  area?: string | null;
  price: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  isDefault?: boolean;
  active?: boolean;
}

/** Canonical product type shared across Products page, POS, and API responses. */
export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  /** Optional sub-category (e.g. "1pc", "2pc", "Gravy") for fastfood-style options */
  sub_category?: string;
  /** "Bar" | "Kitchen" | "LD" */
  department: string;
  /** Resolved unit price for current context (area/date). */
  price: number;
  /** Selected price variant id when resolved. */
  priceId?: string | null;
  cost: number;
  commission: number;
  status: "active" | "inactive";
  /** Override price per area; absent = use base price. */
  pricesByArea?: { Lounge?: number; Club?: number; LD?: number };
  /** All price entries for this SKU. */
  prices?: ProductPrice[];
  /** Prices applicable for current POS area/date (for picker). */
  priceVariants?: ProductPrice[];
  /** Current stock on hand for this SKU. */
  stockQty?: number;
}

/** Map raw API dashboard/tables response to a typed Table (avoids 3× inline casts). */
export function mapApiTable(t: {
  id: string;
  name: string;
  area: string;
  status: string;
  currentOrderId?: string;
  lockedByEmployeeId?: string;
  lockedByName?: string;
}): Table {
  return {
    id: t.id,
    name: t.name,
    area: t.area as Area,
    status: t.status as "available" | "occupied",
    currentOrderId: t.currentOrderId,
    lockedByEmployeeId: t.lockedByEmployeeId,
    lockedByName: t.lockedByName,
  };
}
