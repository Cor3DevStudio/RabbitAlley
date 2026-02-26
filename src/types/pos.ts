// POS shared types

export interface Table {
  id: string;
  name: string;
  area: "Lounge" | "Club" | "LD";
  status: "available" | "occupied";
  currentOrderId?: string;
}

export const areas = ["Lounge", "Club", "LD"] as const;
export type Area = (typeof areas)[number];

/** Canonical product type shared across Products page, POS, and API responses. */
export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  /** "Bar" | "Kitchen" | "LD" */
  department: string;
  price: number;
  cost: number;
  commission: number;
  status: "active" | "inactive";
  /** Override price per area; absent = use base price. */
  pricesByArea?: { Lounge?: number; Club?: number; LD?: number };
}

/** Map raw API dashboard/tables response to a typed Table (avoids 3× inline casts). */
export function mapApiTable(t: {
  id: string;
  name: string;
  area: string;
  status: string;
  currentOrderId?: string;
}): Table {
  return {
    id: t.id,
    name: t.name,
    area: t.area as Area,
    status: t.status as "available" | "occupied",
    currentOrderId: t.currentOrderId,
  };
}
