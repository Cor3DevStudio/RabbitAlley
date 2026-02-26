import { STORAGE_USER, RECEIPT_PRINTER_STORAGE_KEY } from "@/lib/storage-keys";
export { RECEIPT_PRINTER_STORAGE_KEY };

const API = import.meta.env.VITE_API_URL || "";

function getStoredUser(): { id?: string; employeeId?: string; name?: string; role?: string; branchId?: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Branch ID for multi-branch: from logged-in user, default 1 */
function getBranchId(): string {
  const user = getStoredUser();
  return user?.branchId ?? "1";
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const branchId = getBranchId();
  const user = getStoredUser();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Branch-Id": branchId,
    ...(options?.headers as Record<string, string>),
  };
  if (user?.id) headers["X-User-Id"] = user.id;
  if (user?.employeeId) headers["X-Employee-Id"] = user.employeeId;
  if (user?.name) headers["X-User-Name"] = user.name;
  if (user?.role) headers["X-User-Role"] = user.role;

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Request failed");
  return data as T;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  department: "Bar" | "Kitchen" | "LD";
  sentToDept?: boolean;
  /** Complimentary (free) item — tracked in UI and receipt */
  isComplimentary?: boolean;
  /** Staff ID who served this item (for commission) */
  servedBy?: string;
  /** Staff display name for served-by (UI only) */
  servedByName?: string;
}

export interface Order {
  id: string;
  tableId: string;
  status: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  employeeId?: string;
  orderDate?: string;
}

export interface Branch {
  id: number;
  name: string;
  code: string;
  address?: string;
  active: boolean;
}

export const api = {
  auth: {
    verifyManager: (employeeId: string, password: string, opts?: { discountName?: string; discountId?: string; action?: "charge"; customerName?: string }) =>
      fetchApi<{ ok: boolean; managerName: string }>("/api/auth/verify-manager", {
        method: "POST",
        body: JSON.stringify({
          employeeId,
          password,
          discountName: opts?.discountName,
          discountId: opts?.discountId,
          action: opts?.action,
          customerName: opts?.customerName,
        }),
      }),
  },
  branches: {
    list: () => fetchApi<Branch[]>("/api/branches"),
  },
  charges: {
    list: (params?: { customerName?: string; status?: string; from?: string; to?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.customerName) q.set("customerName", params.customerName);
      if (params?.status) q.set("status", params.status);
      if (params?.from) q.set("from", params.from);
      if (params?.to) q.set("to", params.to);
      if (params?.limit) q.set("limit", String(params.limit));
      return fetchApi<ChargeTransaction[]>("/api/charges" + (q.toString() ? "?" + q.toString() : ""));
    },
    markPaid: (id: string, paidBy?: string) =>
      fetchApi<{ ok: boolean }>(`/api/charges/${id}/mark-paid`, {
        method: "PATCH",
        body: JSON.stringify({ paidBy }),
      }),
  },
  auditLogs: {
    list: (params?: { from?: string; to?: string; userId?: string; employeeId?: string; action?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.from) q.set("from", params.from);
      if (params?.to) q.set("to", params.to);
      if (params?.userId) q.set("userId", params.userId);
      if (params?.employeeId) q.set("employeeId", params.employeeId);
      if (params?.action) q.set("action", params.action);
      if (params?.limit) q.set("limit", String(params.limit));
      return fetchApi<Array<{
        id: number;
        userId: number | null;
        employeeId: string | null;
        userName: string | null;
        roleName: string | null;
        action: string;
        entityType: string | null;
        entityId: string | null;
        details: Record<string, unknown> | null;
        createdAt: string;
      }>>("/api/audit-logs?" + q.toString());
    },
  },
  dashboard: {
    stats: () => fetchApi<{ todaysOrders: number; todaysSales: number; openTables: number; pendingOrders: number }>("/api/dashboard/stats"),
    tables: () => fetchApi<Array<{ id: string; name: string; area: string; status: string; currentOrderId?: string }>>("/api/dashboard/tables"),
    createTable: (body: { name: string; area: string }) =>
      fetchApi<{ id: string; name: string; area: string; status: string; currentOrderId?: string }>("/api/dashboard/tables", { method: "POST", body: JSON.stringify(body) }),
    updateTable: (id: string, body: { name?: string; area?: string; status?: string }) =>
      fetchApi<{ id: string; name: string; area: string; status: string; currentOrderId?: string }>(`/api/dashboard/tables/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    deleteTable: (id: string) => fetchApi<{ ok: boolean }>(`/api/dashboard/tables/${id}`, { method: "DELETE" }),
  },
  orders: {
    create: (body: { tableId: string; employeeId?: string; items: OrderItem[]; subtotal: number; tax: number; total: number }) =>
      fetchApi<{ ok: boolean; orderId: string }>("/api/orders", { method: "POST", body: JSON.stringify(body) }),
    addItems: (orderId: string, items: OrderItem[]) =>
      fetchApi<{ ok: boolean; subtotal: number; tax: number; total: number }>(`/api/orders/${orderId}/items`, { method: "POST", body: JSON.stringify({ items }) }),
    getByTable: (tableId: string) =>
      fetchApi<{
        orders: Array<Order & { items: OrderItem[] }>;
        tableStatus: "available" | "occupied";
      }>(`/api/orders/table/${tableId}`),
    pay: (orderId: string, paymentMethod?: string) =>
      fetchApi<{ ok: boolean }>(`/api/orders/${orderId}/pay`, { method: "PATCH", body: JSON.stringify({ paymentMethod }) }),
  },
  products: {
    list: (params?: { search?: string; category?: string; department?: string; area?: "Lounge" | "Club" | "LD" }) => {
      const q = new URLSearchParams();
      if (params?.search) q.set("search", params.search);
      if (params?.category) q.set("category", params.category);
      if (params?.department) q.set("department", params.department);
      if (params?.area) q.set("area", params.area);
      return fetchApi<Array<{ id: string; sku: string; name: string; description?: string; category: string; department: string; price: number; cost: number; commission: number; status: string; pricesByArea?: { Lounge?: number; Club?: number; LD?: number } }>>("/api/products?" + q.toString());
    },
    create: (body: { sku: string; name: string; description?: string; category?: string; department?: string; price?: number; cost?: number; commission?: number; status?: string; pricesByArea?: { Lounge?: number; Club?: number; LD?: number } }) =>
      fetchApi<{ id: string; sku: string; name: string; description?: string; category: string; department: string; price: number; cost: number; commission: number; status: string; pricesByArea?: Record<string, number> }>("/api/products", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: { sku: string; name: string; description?: string; category?: string; department?: string; price?: number; cost?: number; commission?: number; status?: string; pricesByArea?: { Lounge?: number; Club?: number; LD?: number } }) =>
      fetchApi<{ id: string; sku: string; name: string; description?: string; category: string; department: string; price: number; cost: number; commission: number; status: string; pricesByArea?: Record<string, number> }>(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    setStatus: (id: string, status: string) => fetchApi<{ ok: boolean }>(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  },
  staff: {
    ldLadies: () =>
      fetchApi<Array<{ id: string; code: string; name: string }>>("/api/staff/ld-ladies"),
    roles: () =>
      fetchApi<Array<{ id: string; name: string }>>("/api/staff/roles"),
    list: () => fetchApi<Array<{ 
      id: string; code: string; name: string; nickname: string; type: string; 
      allowance: number; hourly: number; budget: number; commissionRate: number;
      incentiveRate: number; tableIncentive: number; hasQuota: boolean; quotaAmount: number;
      hasLogin: boolean; status: string 
    }>>("/api/staff"),
    create: (body: { 
      code: string; name: string; nickname?: string; type?: string; allowance?: number; hourly?: number;
      budget?: number; commissionRate?: number; incentiveRate?: number; tableIncentive?: number;
      hasQuota?: boolean; quotaAmount?: number; password?: string 
    }) =>
      fetchApi<{ 
        id: string; code: string; name: string; nickname: string; type: string;
        allowance: number; hourly: number; budget: number; commissionRate: number;
        incentiveRate: number; tableIncentive: number; hasQuota: boolean; quotaAmount: number;
        hasLogin: boolean; status: string 
      }>("/api/staff", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: { 
      code?: string; name?: string; nickname?: string; type?: string; allowance?: number; hourly?: number;
      budget?: number; commissionRate?: number; incentiveRate?: number; tableIncentive?: number;
      hasQuota?: boolean; quotaAmount?: number; status?: string 
    }) =>
      fetchApi<{ 
        id: string; code: string; name: string; nickname: string; type: string;
        allowance: number; hourly: number; budget: number; commissionRate: number;
        incentiveRate: number; tableIncentive: number; hasQuota: boolean; quotaAmount: number;
        hasLogin: boolean; status: string 
      }>(`/api/staff/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    resetPassword: (id: string, password: string) =>
      fetchApi<{ ok: boolean }>(`/api/staff/${id}/password`, { method: "PATCH", body: JSON.stringify({ password }) }),
  },
  discounts: {
    list: () => fetchApi<Array<{ id: string; name: string; type: string; category?: string | null; applicableTo: string; value: string; validFrom?: string | null; validTo?: string | null; status: string; creator: string }>>("/api/discounts"),
    create: (body: { name: string; type?: string; category?: string; applicableTo?: string; value: string; validFrom?: string; validTo?: string }) =>
      fetchApi<{ id: string; name: string; type: string; category?: string | null; applicableTo: string; value: string; validFrom?: string | null; validTo?: string | null; status: string; creator: string }>("/api/discounts", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: { name: string; type?: string; category?: string | null; applicableTo?: string; value: string; validFrom?: string | null; validTo?: string | null; status?: string }) =>
      fetchApi<{ id: string; name: string; type: string; category?: string | null; applicableTo: string; value: string; validFrom?: string | null; validTo?: string | null; status: string; creator: string }>(
        `/api/discounts/${id}`,
        { method: "PUT", body: JSON.stringify(body) }
      ),
    remove: (id: string) => fetchApi<{ ok: boolean }>(`/api/discounts/${id}`, { method: "DELETE" }),
    approve: (id: string) => fetchApi<{ ok: boolean }>(`/api/discounts/${id}/approve`, { method: "PATCH" }),
    reject: (id: string) => fetchApi<{ ok: boolean }>(`/api/discounts/${id}/reject`, { method: "PATCH" }),
  },
  reports: {
    sales: (from?: string, to?: string) => {
      const q = new URLSearchParams();
      if (from) q.set("from", from);
      if (to) q.set("to", to || from || new Date().toISOString().slice(0, 10));
      return fetchApi<{ list: Array<{ id: string; area: string; table: string; employee: string; subtotal: number; discount: number; tax: number; total: number; status: string; time: string }>; summary: { totalOrders: number; totalSales: number; totalDiscounts: number; totalTax: number } }>("/api/reports/sales?" + q.toString());
    },
    payroll: (from?: string, to?: string) => {
      const q = new URLSearchParams();
      if (from) q.set("from", from);
      if (to) q.set("to", to || from || new Date().toISOString().slice(0, 10));
      return fetchApi<Array<{
        id: string; employeeId: string; name: string; defaultAllowance: number; perHour: number;
        allowance: number; hours: number; commission: number; incentives: number; adjustments: number; deductions: number;
        total: number; netPayout: number; status: string; approvedBy: string | null;
      }>>("/api/reports/payroll?" + q.toString());
    },
    updatePayout: (id: string, body: {
      incentives?: number;
      adjustments?: number;
      deductions?: number;
      incentivesBreakdown?: Array<{ title: string; amount: number }>;
      adjustmentsBreakdown?: Array<{ title: string; amount: number }>;
      deductionsBreakdown?: Array<{ title: string; amount: number }>;
    }) =>
      fetchApi<{ ok: boolean }>(`/api/reports/payroll/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    approvePayout: (id: string, approvedBy?: string) => fetchApi<{ ok: boolean }>(`/api/reports/payroll/${id}/approve`, { method: "PATCH", body: JSON.stringify({ approvedBy }) }),
    computePayouts: (from?: string, to?: string) => 
      fetchApi<{ ok: boolean; computed: number; results: Array<{ employeeId: string; name: string; allowance: number; commission: number; incentives: number; total: number; quotaReached: boolean }> }>(
        "/api/reports/payroll/compute", 
        { method: "POST", body: JSON.stringify({ from, to }) }
      ),
    payrollById: (id: string) =>
      fetchApi<{
        id: string; userId: string; employeeId: string; name: string; perHour: number; periodFrom: string; periodTo: string;
        allowance: number; hours: number; commission: number; incentives: number; adjustments: number; deductions: number;
        gross: number; total: number; netPayout: number; status: string; approvedBy: string | null;
      }>(`/api/reports/payroll/${id}`),
    /** Save X/Z report (or other print) HTML to project prints folder — no "Save As" dialog */
    savePrint: (body: { type: string; html: string }) =>
      fetchApi<{ ok: boolean; filename?: string; path?: string }>("/api/reports/save-print", { method: "POST", body: JSON.stringify(body) }),
  },
  print: {
    printers: () =>
      fetchApi<{ printers: Array<{ name: string; isDefault?: boolean }>; error?: string }>("/api/print/printers"),
    receipt: (
      receipt: {
        orderNumber: string;
        date: string;
        time: string;
        table: string;
        cashier: string;
        items: Array<{ name: string; quantity: number; subtotal: number; isComplimentary?: boolean }>;
        subtotal: number;
        complimentary?: number;
        discount?: number;
        serviceCharge: number;
        tax: number;
        cardSurcharge?: number;
        total: number;
        paymentMethod: string;
        amountPaid: number;
        change: number;
      },
      printerName?: string | null
    ) =>
      fetchApi<{ ok: boolean; error?: string; fallback?: boolean }>("/api/print/receipt", {
        method: "POST",
        body: JSON.stringify({ receipt, printerName: printerName || undefined }),
      }),
    payslip: (payslip: {
      employeeId: string; name: string; periodFrom: string; periodTo: string;
      allowance: number; hours: number; perHour: number; commission: number; incentives: number; adjustments: number; deductions: number;
      gross: number; netPayout: number; status: string; approvedBy?: string | null;
    }) => fetchApi<{ ok: boolean; error?: string; fallback?: boolean }>("/api/print/payslip", { method: "POST", body: JSON.stringify({ payslip }) }),
  },
  // ============================================================================
  // ATTENDANCE (TIME TRACKING)
  // ============================================================================
  attendance: {
    clockIn: (userId: string) =>
      fetchApi<{ id: number; userId: string; workDate: string; timeIn: string; timeOut: string | null; breakMinutes: number }>(
        "/api/attendance/clock-in",
        { method: "POST", body: JSON.stringify({ userId }) }
      ),
    clockOut: (userId: string) =>
      fetchApi<{ id: number; userId: string; workDate: string; timeIn: string; timeOut: string; breakMinutes: number }>(
        "/api/attendance/clock-out",
        { method: "POST", body: JSON.stringify({ userId }) }
      ),
    getToday: (userId: string) =>
      fetchApi<{ id: number; userId: string; workDate: string; timeIn: string; timeOut: string | null; breakMinutes: number } | null>(
        `/api/attendance/today?userId=${userId}`
      ),
    list: (params?: { userId?: string; from?: string; to?: string }) => {
      const q = new URLSearchParams();
      if (params?.userId) q.set("userId", params.userId);
      if (params?.from) q.set("from", params.from);
      if (params?.to) q.set("to", params.to || params.from || new Date().toISOString().slice(0, 10));
      return fetchApi<Array<{
        id: number; userId: string; employeeId: string; name: string;
        workDate: string; timeIn: string; timeOut: string | null; breakMinutes: number;
      }>>("/api/attendance?" + q.toString());
    },
  },
  // ============================================================================
  // SHIFT MANAGEMENT
  // ============================================================================
  shifts: {
    getCurrent: (userId: string) => 
      fetchApi<Shift | null>(`/api/shifts/current?userId=${userId}`),
    open: (userId: string, openingCash: number) =>
      fetchApi<Shift>("/api/shifts/open", { method: "POST", body: JSON.stringify({ userId, openingCash }) }),
    getSummary: (shiftId: string) =>
      fetchApi<ShiftSummary>(`/api/shifts/${shiftId}/summary`),
    close: (shiftId: string, data: { actualCash: number; cashCount?: CashCountItem[]; varianceReason?: string; notes?: string }) =>
      fetchApi<Shift>(`/api/shifts/${shiftId}/close`, { method: "POST", body: JSON.stringify(data) }),
    approve: (shiftId: string, approvedBy: string) =>
      fetchApi<Shift>(`/api/shifts/${shiftId}/approve`, { method: "POST", body: JSON.stringify({ approvedBy }) }),
    list: (params?: { userId?: string; status?: string; dateFrom?: string; dateTo?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.userId) q.set("userId", params.userId);
      if (params?.status) q.set("status", params.status);
      if (params?.dateFrom) q.set("dateFrom", params.dateFrom);
      if (params?.dateTo) q.set("dateTo", params.dateTo);
      if (params?.limit) q.set("limit", String(params.limit));
      return fetchApi<ShiftListItem[]>("/api/shifts?" + q.toString());
    },
  },
  // ============================================================================
  // PAYMENT CONVERSIONS (digital -> cash, e.g. pasahod)
  // ============================================================================
  conversions: {
    create: (data: { fromMethod: string; toMethod?: string; amount: number; notes?: string; shiftId?: number }) =>
      fetchApi<PaymentConversion>("/api/conversions", { method: "POST", body: JSON.stringify(data) }),
    list: (params?: { shiftId?: string; from?: string; to?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.shiftId) q.set("shiftId", params.shiftId);
      if (params?.from) q.set("from", params.from);
      if (params?.to) q.set("to", params.to);
      if (params?.limit) q.set("limit", String(params.limit));
      return fetchApi<PaymentConversion[]>("/api/conversions" + (q.toString() ? "?" + q.toString() : ""));
    },
  },
  // ============================================================================
  // REFUNDS
  // ============================================================================
  refunds: {
    create: (data: { orderId: number; originalPaymentMethod: string; refundAmount: number; refundMethod: string; reason: string; requestedBy: string; shiftId?: string }) =>
      fetchApi<Refund>("/api/refunds", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: { status: string; approvedBy?: string }) =>
      fetchApi<Refund>(`/api/refunds/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    list: (params?: { orderId?: string; status?: string; dateFrom?: string; dateTo?: string }) => {
      const q = new URLSearchParams();
      if (params?.orderId) q.set("orderId", params.orderId);
      if (params?.status) q.set("status", params.status);
      if (params?.dateFrom) q.set("dateFrom", params.dateFrom);
      if (params?.dateTo) q.set("dateTo", params.dateTo);
      return fetchApi<RefundListItem[]>("/api/refunds?" + q.toString());
    },
  },
  // ============================================================================
  // PAYMENT VOIDS
  // ============================================================================
  paymentVoids: {
    create: (data: { orderId: number; paymentMethod: string; voidedAmount: number; reason: string; requestedBy: string; shiftId?: string }) =>
      fetchApi<PaymentVoid>("/api/payment-voids", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: { status: string; approvedBy?: string }) =>
      fetchApi<PaymentVoid>(`/api/payment-voids/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  },
  // ============================================================================
  // SPLIT PAYMENTS
  // ============================================================================
  splitPayments: {
    create: (orderId: string, splits: Array<{ amount: number; paymentMethod: string }>) =>
      fetchApi<SplitPayment[]>("/api/split-payments", { method: "POST", body: JSON.stringify({ orderId, splits }) }),
    pay: (splitId: string, processedBy: string) =>
      fetchApi<SplitPayment>(`/api/split-payments/${splitId}/pay`, { method: "PUT", body: JSON.stringify({ processedBy }) }),
    getForOrder: (orderId: string) =>
      fetchApi<SplitPayment[]>(`/api/split-payments/${orderId}`),
  },
  // ============================================================================
  // TABLE TRANSFERS
  // ============================================================================
  tables: {
    payAll: (tableId: string, paymentMethod?: string, discountName?: string, discountAmount?: number, customerName?: string) =>
      fetchApi<{ ok: boolean; orderIds: string[]; subtotal: number; discount: number; tax: number; total: number }>(
        `/api/tables/${tableId}/pay-all`,
        { method: "POST", body: JSON.stringify({ paymentMethod, discountName, discountAmount, customerName }) }
      ),
    transfer: (data: { orderId: string; fromTable: string; toTable: string; transferredBy: string; reason?: string }) =>
      fetchApi<{ ok: boolean; message: string }>("/api/tables/transfer", { method: "POST", body: JSON.stringify(data) }),
    merge: (data: { sourceOrderId: string; targetOrderId: string; transferredBy: string; reason?: string }) =>
      fetchApi<{ ok: boolean; message: string }>("/api/tables/merge", { method: "POST", body: JSON.stringify(data) }),
    getTransfers: (orderId: string) =>
      fetchApi<TableTransfer[]>(`/api/tables/transfers/${orderId}`),
  },
  // ============================================================================
  // SETTINGS (business config — persisted in database)
  // ============================================================================
  settings: {
    /** Fetch all settings from DB as a key→value map. */
    get: () => fetchApi<Record<string, string>>("/api/settings"),
    /** Upsert one or more settings rows. */
    save: (data: Record<string, string>) =>
      fetchApi<{ ok: boolean }>("/api/settings", { method: "PUT", body: JSON.stringify(data) }),
  },
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Shift {
  id: number;
  user_id: number;
  shift_date: string;
  start_time: string;
  end_time: string | null;
  status: "open" | "closed" | "approved";
  opening_cash: number;
  total_cash_sales: number;
  total_card_sales: number;
  total_gcash_sales: number;
  total_bank_sales: number;
  total_refunds: number;
  total_voids: number;
  expected_cash: number;
  actual_cash: number | null;
  cash_variance: number | null;
  variance_reason: string | null;
  approved_by: number | null;
  approved_at: string | null;
  notes: string | null;
}

export interface ShiftListItem extends Shift {
  user_name: string;
}

export interface ShiftSummary {
  shift: Shift;
  sales: {
    cash: number;
    card: number;
    gcash: number;
    bank: number;
    total: number;
    transactionCount: number;
  };
  refunds: number;
  voids: number;
  conversions?: Array<{ fromMethod: string; toMethod: string; amount: number; notes?: string; convertedBy?: string; convertedAt?: string }>;
  expectedCash: number;
}

export interface PaymentConversion {
  id: number;
  shiftId?: number;
  fromMethod: string;
  toMethod: string;
  amount: number;
  notes?: string;
  convertedBy?: string;
  convertedAt: string;
}

export interface ChargeTransaction {
  id: number;
  orderIds?: string;
  customerName: string;
  amount: number;
  status: "pending" | "paid";
  chargedAt: string;
  paidAt?: string;
  chargedBy?: string;
  paidBy?: string;
  notes?: string;
}

export interface CashCountItem {
  denomination: string;
  quantity: number;
  subtotal: number;
}

export interface Refund {
  id: number;
  order_id: number;
  original_payment_method: string;
  refund_amount: number;
  refund_method: string;
  reason: string;
  status: "pending" | "approved" | "completed" | "rejected";
  requested_by: number;
  approved_by: number | null;
  shift_id: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface RefundListItem extends Refund {
  table_id: string;
  requested_by_name: string;
}

export interface PaymentVoid {
  id: number;
  order_id: number;
  payment_method: string;
  voided_amount: number;
  reason: string;
  status: "pending" | "approved" | "completed" | "rejected";
  requested_by: number;
  approved_by: number | null;
  shift_id: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface SplitPayment {
  id: number;
  order_id: number;
  split_number: number;
  amount: number;
  payment_method: string;
  status: "pending" | "paid";
  paid_at: string | null;
  processed_by: number | null;
}

export interface TableTransfer {
  id: number;
  order_id: number;
  from_table: string;
  to_table: string;
  transfer_type: "move" | "merge" | "split";
  transferred_by: number;
  transferred_by_name: string;
  reason: string | null;
  created_at: string;
}
