import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { api, RECEIPT_PRINTER_STORAGE_KEY, type OrderItem } from "@/lib/api";
import { getPosSettings } from "@/lib/posSettings";
import { mapApiTable, type Table, type Product } from "@/types/pos";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, CreditCard, Eye, Printer, ChefHat, Wine, Banknote, Smartphone, Building2, Wallet, Tag, Percent, X, Gift, Plus, Lock, Receipt, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  VisuallyHidden,
} from "@/components/ui/dialog";

type PaymentMethod = "cash" | "gcash" | "debit" | "credit" | "bank" | "charge";
type SplitMethod = "cash" | "gcash" | "bank";

/** Tab = one order. id=null means draft (not yet sent). */
interface OrderTab {
  id: string | null;
  items: OrderItem[];
  sent: boolean;
}

export default function POSTableOrder() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [table, setTable] = useState<Table | null>(null);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [orderTabs, setOrderTabs] = useState<OrderTab[]>([{ id: null, items: [], sent: false }]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [sendToDeptOpen, setSendToDeptOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentStep, setPaymentStep] = useState<"processing" | "printing" | "done">("processing");
  const [lastReceiptForPrint, setLastReceiptForPrint] = useState<{
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
  } | null>(null);
  const [paymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("cash");
  const [useSplitPayment, setUseSplitPayment] = useState(false);
  const [splitPayments, setSplitPayments] = useState<Array<{ amount: string; method: SplitMethod }>>([
    { amount: "", method: "cash" },
    { amount: "", method: "gcash" },
  ]);
  const [chargeCustomerName, setChargeCustomerName] = useState("");
  const [chargeAuthModalOpen, setChargeAuthModalOpen] = useState(false);
  const [chargeAuthCustomerName, setChargeAuthCustomerName] = useState("");
  const [ladyModalOpen, setLadyModalOpen] = useState(false);
  const [pendingLdProduct, setPendingLdProduct] = useState<Product | null>(null);
  const [ldLadies, setLdLadies] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [selectedLady, setSelectedLady] = useState<string>("");
  const [selectedLdLadyForCategory, setSelectedLdLadyForCategory] = useState<string>("");
  const [amountTendered, setAmountTendered] = useState<string>("");
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [managerAuthModalOpen, setManagerAuthModalOpen] = useState(false);
  const [pendingDiscount, setPendingDiscount] = useState<{ id: string; name: string; type: string; value: string } | null>(null);
  const [managerEmployeeId, setManagerEmployeeId] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [managerAuthError, setManagerAuthError] = useState<string | null>(null);
  const [managerAuthLoading, setManagerAuthLoading] = useState(false);
  const [availableDiscounts, setAvailableDiscounts] = useState<Array<{ id: string; name: string; type: string; value: string; category?: string | null }>>([]);
  const [appliedDiscount, setAppliedDiscount] = useState<{ id: string; name: string; type: string; value: string } | null>(null);

  useEffect(() => {
    if (!ladyModalOpen && selectedCategory !== "LD") return;
    api.staff.ldLadies().then(setLdLadies).catch(() => setLdLadies([]));
  }, [ladyModalOpen, selectedCategory]);

  useEffect(() => {
    if (selectedCategory !== "LD" && selectedLdLadyForCategory) {
      setSelectedLdLadyForCategory("");
    }
  }, [selectedCategory, selectedLdLadyForCategory]);

  // Load products from API (with area so prices match table: Lounge vs Club vs LD)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const area = table?.area ?? undefined;
        const productList = await api.products.list(area ? { area } : undefined);
        if (!cancelled) {
          const mappedProducts: Product[] = productList
            .filter(p => p.status === "active")
            .map(p => ({
              id: String(p.id),
              sku: p.sku,
              name: p.name,
              description: p.description,
              category: p.category,
              department: p.department,
              price: p.price,
              cost: p.cost,
              commission: p.commission,
              status: p.status as "active" | "inactive",
              pricesByArea: p.pricesByArea,
            }));
          setProducts(mappedProducts);

          // Build category list from ALL products (active + inactive) so every category shows in POS
          const isListOfLadiesCategory = (cat: string) => /list\s+of\s+ladies/i.test(cat);
          const uniqueCategories = [...new Set(productList.map((p) => p.category).filter(Boolean))].sort();
          const hasLdProducts = productList.some((p) => p.department === "LD");
          const categoryList = hasLdProducts
            ? ["LD", ...uniqueCategories.filter((cat) => cat !== "LD" && !isListOfLadiesCategory(cat))]
            : uniqueCategories.filter((cat) => !isListOfLadiesCategory(cat));
          setCategories(categoryList);
          if (categoryList.length > 0) {
            setSelectedCategory((prev) => (prev && categoryList.includes(prev) ? prev : categoryList[0]));
          }
        }
      } catch {
        // Products failed to load
      }
    })();
    return () => { cancelled = true; };
  }, [table?.area]);

  // Load table and all orders (multi-tab)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tablesRes = await api.dashboard.tables();
        if (!cancelled && tableId) {
          const t = tablesRes.find((r) => r.id === tableId);
          if (t) {
            setTable(mapApiTable(t));
            try {
              const orderData = await api.orders.getByTable(tableId);
              const tabs: OrderTab[] = (orderData.orders || []).map((o) => ({
                id: o.id,
                items: (o.items || []).map((item) => ({
                  productId: item.productId,
                  name: item.name,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  discount: item.discount,
                  subtotal: item.subtotal,
                  department: item.department,
                  isComplimentary: (item as { isComplimentary?: boolean }).isComplimentary,
                  servedBy: (item as { servedBy?: string }).servedBy,
                  servedByName: (item as { servedByName?: string }).servedByName,
                })),
                sent: true,
              }));
              setOrderTabs(tabs.length > 0 ? [...tabs, { id: null, items: [], sent: false }] : [{ id: null, items: [], sent: false }]);
              setActiveTabIndex(0);
            } catch {
              setOrderTabs([{ id: null, items: [], sent: false }]);
            }
          } else {
            setTable(null);
          }
        }
      } catch {
        if (!cancelled) setTable(null);
      } finally {
        if (!cancelled) setTablesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tableId]);

  // Role-based permissions
  const canAddToOrder = hasPermission("create_orders");           // Staff only
  const canSendToDept = hasPermission("send_to_departments");     // Staff only
  const canProcessPayment = hasPermission("accept_payments");     // Cashier, Admin
  const canPrintReceipt = hasPermission("print_receipts");        // Cashier, Admin
  const canRequestVoid = hasPermission("request_voids");
  const canApproveDiscounts = hasPermission("approve_discounts"); // Manager only - skip password if has this
  // Monitor-only: Admin (has no floor operations - no add, no send, no payment)
  const isMonitorOnly = !canAddToOrder && !canSendToDept && !canProcessPayment;

  // Memoize filtered products for better performance (must be before early returns!)
  const filteredProducts = useMemo(
    () =>
      selectedCategory === "LD"
        ? products.filter((p) => p.department === "LD")
        : products.filter((p) => p.category === selectedCategory && p.department !== "LD"),
    [products, selectedCategory]
  );
  const selectedLdLadyProfile = useMemo(
    () => ldLadies.find((lady) => lady.id === selectedLdLadyForCategory),
    [ldLadies, selectedLdLadyForCategory]
  );

  const posSettings = getPosSettings();
  const taxRateDecimal = posSettings.taxRate / 100;
  const cardSurchargeDecimal = posSettings.cardSurcharge / 100;
  const serviceLabel =
    posSettings.serviceChargeMode === "fixed"
      ? `Service (Fixed ₱${posSettings.serviceChargeValue.toFixed(2)})`
      : `Service (${posSettings.serviceChargeValue.toFixed(2).replace(/\.00$/, "")}%)`;
  const taxLabel = `VAT (${posSettings.taxRate.toFixed(2).replace(/\.00$/, "")}%)`;

  const computeServiceCharge = useCallback(
    (baseAmount: number) =>
      posSettings.serviceChargeMode === "fixed"
        ? posSettings.serviceChargeValue
        : baseAmount * (posSettings.serviceChargeValue / 100),
    [posSettings.serviceChargeMode, posSettings.serviceChargeValue]
  );

  const estimateTabTotal = useCallback(
    (items: OrderItem[]) => {
      const tabSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      const tabComplimentary = items
        .filter((item) => item.isComplimentary)
        .reduce((sum, item) => sum + item.subtotal, 0);
      const tabChargeable = tabSubtotal - tabComplimentary;
      const tabTax = tabChargeable * taxRateDecimal;
      const tabService = computeServiceCharge(tabChargeable);
      return tabChargeable + tabTax + tabService;
    },
    [computeServiceCharge, taxRateDecimal]
  );

  const printDeptReceipt = useCallback(
    (deptTitle: string, subtitle: string, items: OrderItem[]) => {
      if (!table || items.length === 0) return;
      const win = window.open("", "_blank", "width=400,height=600");
      if (!win) {
        toast.error("Pop-up blocked. Allow pop-ups to print.");
        return;
      }
      const now = new Date();
      const orderNumber = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${tableId?.replace(/\D/g, "") || "00"}`;
      const encoderName = user?.name || "Staff";
      const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
      const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${deptTitle} Receipt</title>
<style>
  body { font-family: monospace; font-size: 14px; padding: 24px; max-width: 320px; margin: 0 auto; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .row { display: flex; justify-content: space-between; margin: 4px 0; }
  .line { border-top: 1px dashed #ccc; margin: 8px 0; }
  .items { margin: 12px 0; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head><body>
  <div class="center mb-4">
    <div class="bold" style="font-size: 20px; letter-spacing: 0.1em;">${deptTitle}</div>
    <div style="font-size: 12px; color: #666;">${subtitle}</div>
  </div>
  <div class="row"><span>Order No:</span><span>${orderNumber}</span></div>
  <div class="row"><span>Date:</span><span>${dateStr}</span></div>
  <div class="row"><span>Time:</span><span>${timeStr}</span></div>
  <div class="row"><span>Area:</span><span>${table.area}</span></div>
  <div class="row"><span>Table:</span><span>Table ${table.name}</span></div>
  <div class="line"></div>
  <div class="bold mb-2">ITEMS</div>
  <div class="items">
    ${items.map((item) => `<div class="row"><span>${item.quantity}x ${item.name}</span></div>`).join("")}
  </div>
  <div class="line"></div>
  <div class="row" style="font-size: 12px; color: #666;"><span>Encoder:</span><span>${encoderName}</span></div>
  <div class="center mt-4" style="font-size: 12px; color: #999;">================================</div>
</body></html>`;
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
        win.close();
      }, 150);
    },
    [table, user?.name, tableId]
  );

  if (tablesLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!table) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Table not found</p>
          <Link to="/pos" className="text-primary hover:underline mt-2 inline-block">
            Back to Tables
          </Link>
        </div>
      </AppLayout>
    );
  }

  const activeTab = orderTabs[activeTabIndex];
  const orderItems = activeTab?.items ?? [];
  const orderSent = activeTab?.sent ?? false;
  const hasAnySentOrder = orderTabs.some((t) => t.sent);
  const canAddItems = canAddToOrder && activeTab && !activeTab.sent;
  const requiresLdLadySelection = selectedCategory === "LD" && !selectedLdLadyForCategory;

  const updateActiveTabItems = (updater: (items: OrderItem[]) => OrderItem[]) => {
    setOrderTabs((prev) =>
      prev.map((tab, i) =>
        i === activeTabIndex ? { ...tab, items: updater(tab.items) } : tab
      )
    );
  };

  const isLdProduct = (p: Product) => p.department === "LD";

  const addToOrder = (product: Product) => {
    if (!canAddItems) return;
    if (isLdProduct(product)) {
      if (selectedCategory === "LD" && selectedLdLadyForCategory) {
        doAddToOrder(product, selectedLdLadyForCategory, selectedLdLadyProfile?.name);
        return;
      }
      setPendingLdProduct(product);
      setLadyModalOpen(true);
      setSelectedLady(selectedLdLadyForCategory || "");
      return;
    }
    doAddToOrder(product, undefined, undefined);
  };

  const doAddToOrder = (product: Product, servedBy?: string, servedByName?: string) => {
    if (!canAddItems) return;
    updateActiveTabItems((prev) => {
      const existing = prev.find(
        (item) => item.productId === product.id && (item.servedBy ?? "") === (servedBy ?? "")
      );
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id && (item.servedBy ?? "") === (servedBy ?? "")
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unitPrice - item.discount }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: product.price,
          discount: 0,
          subtotal: product.price,
          department: product.department,
          servedBy,
          servedByName,
        },
      ];
    });
  };

  const addNewOrderTab = () => {
    setOrderTabs((prev) => [...prev, { id: null, items: [], sent: false }]);
    setActiveTabIndex(orderTabs.length);
  };

  const removeFromOrder = (productId: string, servedBy?: string) => {
    updateActiveTabItems((prev) =>
      prev.filter((item) => !(item.productId === productId && (item.servedBy ?? "") === (servedBy ?? "")))
    );
  };

  const toggleComplimentary = (productId: string, servedBy?: string) => {
    updateActiveTabItems((prev) =>
      prev.map((item) =>
        item.productId === productId && (item.servedBy ?? "") === (servedBy ?? "")
          ? { ...item, isComplimentary: !item.isComplimentary }
          : item
      )
    );
  };

  const updateQuantity = (productId: string, delta: number, servedBy?: string) => {
    updateActiveTabItems((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId && (item.servedBy ?? "") === (servedBy ?? "")) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              subtotal: newQty * item.unitPrice - item.discount,
            };
          }
          return item;
        })
        .filter(Boolean) as OrderItem[]
    );
  };

  const setItemDiscount = (productId: string, servedBy?: string) => {
    if (!canAddItems) return;
    const target = orderItems.find(
      (item) => item.productId === productId && (item.servedBy ?? "") === (servedBy ?? "")
    );
    if (!target) return;
    const maxDiscount = target.unitPrice * target.quantity;
    const input = window.prompt(
      `Enter item discount amount (max ${formatCurrency(maxDiscount)}):`,
      String(target.discount || 0)
    );
    if (input === null) return;
    const nextDiscount = Number(input);
    if (!Number.isFinite(nextDiscount) || nextDiscount < 0) {
      toast.error("Invalid discount amount");
      return;
    }
    if (nextDiscount > maxDiscount) {
      toast.error("Discount cannot exceed item total");
      return;
    }
    updateActiveTabItems((prev) =>
      prev.map((item) =>
        item.productId === productId && (item.servedBy ?? "") === (servedBy ?? "")
          ? {
              ...item,
              discount: nextDiscount,
              subtotal: item.quantity * item.unitPrice - nextDiscount,
            }
          : item
      )
    );
  };

  // Current tab totals (for display)
  const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const complimentaryTotal = orderItems
    .filter((item) => item.isComplimentary)
    .reduce((sum, item) => sum + item.subtotal, 0);
  const chargeableSubtotal = subtotal - complimentaryTotal;
  const tax = chargeableSubtotal * taxRateDecimal;
  const serviceCharge = computeServiceCharge(chargeableSubtotal);
  const total = chargeableSubtotal + tax + serviceCharge;

  // Combined totals from ALL sent tabs (for payment)
  const sentTabs = orderTabs.filter((t) => t.sent);
  const combinedItems = sentTabs.flatMap((t) => t.items);
  const combinedSubtotal = combinedItems.reduce((s, i) => s + i.subtotal, 0);
  const combinedComplimentary = combinedItems.filter((i) => i.isComplimentary).reduce((s, i) => s + i.subtotal, 0);
  const combinedChargeable = combinedSubtotal - combinedComplimentary;
  const combinedTax = combinedChargeable * taxRateDecimal;
  const combinedServiceCharge = computeServiceCharge(combinedChargeable);
  const combinedTotalBeforeDiscount = combinedChargeable + combinedTax + combinedServiceCharge;

  // Group items by department for Send to Dept modal
  const barItems = orderItems.filter((item) => item.department === "Bar");
  const kitchenItems = orderItems.filter((item) => item.department === "Kitchen");
  const ldItems = orderItems.filter((item) => item.department === "LD");

  // Generate order number (for display in Send to Dept modal)
  const now = new Date();
  const orderNumber = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${tableId?.replace(/\D/g, "") || "00"}`;

  const handleConfirmSend = async () => {
    setSending(true);
    try {
      if (!tableId) return;
      const result = await api.orders.create({
        tableId,
        employeeId: user?.employeeId,
        items: orderItems,
        subtotal,
        tax,
        total,
      });
      setTable((prev) => prev ? { ...prev, status: "occupied", currentOrderId: result.orderId } : prev);
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (barItems.length > 0) toast.success(`${barItems.length} item(s) sent to Bar`);
      if (kitchenItems.length > 0) toast.success(`${kitchenItems.length} item(s) sent to Kitchen`);
      if (ldItems.length > 0) toast.success(`${ldItems.length} item(s) sent to LD`);
      // Convert tab to sent, add new draft tab
      setOrderTabs((prev) => {
        const next = [...prev];
        next[activeTabIndex] = { id: result.orderId, items: orderItems, sent: true };
        next.push({ id: null, items: [], sent: false });
        return next;
      });
      setActiveTabIndex(activeTabIndex + 1);
    } catch {
      toast.error("Failed to send order to departments");
    } finally {
      setSending(false);
      setSendToDeptOpen(false);
    }
  };

  // Discount & payment totals (on combined sent tabs)
  const discountAmount = appliedDiscount
    ? appliedDiscount.value.includes("%")
      ? combinedChargeable * (parseFloat(appliedDiscount.value) / 100)
      : parseFloat(appliedDiscount.value) || 0
    : 0;
  const discountedSubtotal = combinedChargeable - discountAmount;
  const discountedTax = discountedSubtotal * taxRateDecimal;
  const discountedServiceCharge = computeServiceCharge(discountedSubtotal);
  const discountedTotal = discountedSubtotal + discountedTax + discountedServiceCharge;
  const hasCardSurcharge = selectedPaymentMethod === "debit" || selectedPaymentMethod === "credit";
  const cardSurcharge = hasCardSurcharge ? discountedSubtotal * cardSurchargeDecimal : 0;
  const finalTotal = discountedTotal + cardSurcharge;
  const change = amountTendered ? Math.max(0, parseFloat(amountTendered) - finalTotal) : 0;
  const splitTotal = splitPayments.reduce((sum, split) => sum + (Number(split.amount) || 0), 0);
  const splitRemaining = finalTotal - splitTotal;
  const splitValid =
    useSplitPayment &&
    splitPayments.length >= 2 &&
    splitPayments.every((split) => Number(split.amount) > 0) &&
    Math.abs(splitRemaining) < 0.01;

  const handleRequestVoid = async () => {
    if (!hasAnySentOrder) {
      toast.error("No sent orders to void");
      return;
    }
    const reason = window.prompt("Enter reason for void request:");
    if (!reason || !reason.trim()) return;
    try {
      await Promise.all(
        sentTabs
          .filter((tab) => tab.id)
          .map((tab) =>
            api.paymentVoids.create({
              orderId: Number(tab.id),
              paymentMethod: "cash",
              voidedAmount: estimateTabTotal(tab.items),
              reason: reason.trim(),
              requestedBy: user?.id || "",
            })
          )
      );
      toast.success("Void request submitted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit void request");
    }
  };

  const handleProcessPayment = async () => {
    if (!hasAnySentOrder) {
      toast.error("Send at least one order to departments first");
      return;
    }
    if (!tableId) return;
    try {
      const discounts = await api.discounts.list();
      setAvailableDiscounts(discounts.filter((d) => d.status === "approved"));
    } catch {
      // Discounts failed to load
    }
    setPaymentMethodModalOpen(true);
    setSelectedPaymentMethod("cash");
    setAmountTendered("");
    setAppliedDiscount(null);
    setChargeCustomerName("");
    setUseSplitPayment(false);
    setSplitPayments([
      { amount: "", method: "cash" },
      { amount: "", method: "gcash" },
    ]);
  };

  const handleConfirmPayment = async () => {
    // Close payment method modal and open processing modal
    setPaymentMethodModalOpen(false);
    setPaymentModalOpen(true);
    setPaymentStep("processing");
    setProcessingPayment(true);
    
    try {
      if (!tableId) throw new Error("No table");
      let paidOrderIds: string[] = [];
      if (useSplitPayment) {
        if (!splitValid) {
          throw new Error("Split payment amounts must exactly match the total");
        }
        if (sentTabs.length !== 1 || !sentTabs[0]?.id) {
          throw new Error("Split payment currently supports one sent order only");
        }
        const createdSplits = await api.splitPayments.create(
          sentTabs[0].id,
          splitPayments.map((split) => ({
            amount: Number(split.amount) || 0,
            paymentMethod: split.method,
          }))
        );
        for (const split of createdSplits) {
          await api.splitPayments.pay(String(split.id), user?.id || "");
        }
        paidOrderIds = [sentTabs[0].id];
      } else {
        const payResult = await api.tables.payAll(
          tableId,
          selectedPaymentMethod,
          appliedDiscount?.name,
          discountAmount > 0 ? discountAmount : undefined,
          selectedPaymentMethod === "charge" ? chargeCustomerName : undefined
        );
        paidOrderIds = payResult.orderIds || [];
      }
      setPaymentStep("printing");
      const paymentMethodLabel = useSplitPayment
        ? "split_payment"
        : selectedPaymentMethod === "charge"
          ? `Charge - ${chargeCustomerName}`
          : selectedPaymentMethod;
      const receiptData = {
        orderNumber: paidOrderIds[0] || orderNumber,
        date: now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
        time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        table: `${table?.area} - ${table?.name}`,
        cashier: user?.name || "Staff",
        items: combinedItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          subtotal: item.subtotal,
          isComplimentary: item.isComplimentary,
        })),
        subtotal: combinedSubtotal,
        complimentary: combinedComplimentary > 0 ? combinedComplimentary : undefined,
        discount: discountAmount > 0 ? discountAmount : undefined,
        serviceCharge: discountedServiceCharge,
        tax: discountedTax,
        cardSurcharge: hasCardSurcharge ? cardSurcharge : undefined,
        total: finalTotal,
        paymentMethod: paymentMethodLabel,
        amountPaid: !useSplitPayment && selectedPaymentMethod === "cash" ? parseFloat(amountTendered) || finalTotal : finalTotal,
        change: !useSplitPayment && selectedPaymentMethod === "cash" ? change : 0,
      };
      setLastReceiptForPrint(receiptData);

      // Try to print via backend (automatic when Node 20 + printer package + PRINTER_INTERFACE=printer:Name)
      let receiptSent = false;
      try {
        const printerName = localStorage.getItem(RECEIPT_PRINTER_STORAGE_KEY);
        const printResult = await api.print.receipt(receiptData, printerName || undefined);
        if (printResult.ok) {
          receiptSent = true;
        }
        // If ok: false we do not open the browser print dialog; user can click "Print receipt" if needed
      } catch (_printErr) {
        // API error — do not open dialog; "Print receipt" button remains available
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
      setPaymentStep("done");
      toast.success(receiptSent ? "Payment processed. Receipt sent to printer." : "Payment processed. Click «Print receipt» if you need a copy.");
    } catch {
      toast.error("Failed to process payment");
      setPaymentModalOpen(false);
    } finally {
      setProcessingPayment(false);
    }
  };

  // Browser print fallback function
  const printReceiptViaBrowser = (receipt: {
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
  }) => {
    const printWindow = window.open("", "_blank", "width=300,height=600");
    if (!printWindow) {
      toast.error("Receipt print window was blocked. Allow popups for this site and try again, or use the browser Print menu.");
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { 
            font-family: 'Courier New', monospace; 
            font-size: 12px; 
            width: 80mm; 
            margin: 0; 
            padding: 10px;
            box-sizing: border-box;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .line { border-top: 1px dashed #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .title { font-size: 16px; font-weight: bold; }
          h1 { margin: 0; font-size: 18px; }
        </style>
      </head>
      <body>
        <div class="center">
          <h1>RABBIT ALLEY</h1>
          <div>Bar & Restaurant</div>
          <div>123 Main Street, City</div>
          <div>Tel: (02) 123-4567</div>
        </div>
        <div class="line"></div>
        <div class="row"><span>Order #:</span><span>${receipt.orderNumber}</span></div>
        <div class="row"><span>Date:</span><span>${receipt.date}</span></div>
        <div class="row"><span>Time:</span><span>${receipt.time}</span></div>
        <div class="row"><span>Table:</span><span>${receipt.table}</span></div>
        <div class="row"><span>Cashier:</span><span>${receipt.cashier}</span></div>
        <div class="line"></div>
        <div class="bold">ITEMS</div>
        ${receipt.items.map(item => `
          <div class="row">
            <span>${item.quantity}x ${item.name}</span>
            <span>₱${item.subtotal.toFixed(2)}</span>
          </div>
        `).join("")}
        <div class="line"></div>
        <div class="row"><span>Subtotal:</span><span>₱${receipt.subtotal.toFixed(2)}</span></div>
        ${receipt.complimentary ? `<div class="row"><span>Less Compli:</span><span>-₱${receipt.complimentary.toFixed(2)}</span></div>` : ""}
        ${receipt.discount ? `<div class="row"><span>Discount:</span><span>-₱${receipt.discount.toFixed(2)}</span></div>` : ""}
        <div class="row"><span>${serviceLabel}:</span><span>₱${receipt.serviceCharge.toFixed(2)}</span></div>
        <div class="row"><span>${taxLabel}:</span><span>₱${receipt.tax.toFixed(2)}</span></div>
        ${receipt.cardSurcharge ? `<div class="row"><span>Card Fee (${posSettings.cardSurcharge.toFixed(2).replace(/\.00$/, "")}%):</span><span>₱${receipt.cardSurcharge.toFixed(2)}</span></div>` : ""}
        <div class="line"></div>
        <div class="row bold"><span>TOTAL:</span><span>₱${receipt.total.toFixed(2)}</span></div>
        <div class="line"></div>
        <div class="row"><span>Payment:</span><span>${receipt.paymentMethod.toUpperCase()}</span></div>
        <div class="row"><span>Amount Paid:</span><span>₱${receipt.amountPaid.toFixed(2)}</span></div>
        <div class="row"><span>Change:</span><span>₱${receipt.change.toFixed(2)}</span></div>
        <div class="line"></div>
        <div class="center">
          <div class="bold">Thank you for dining with us!</div>
          <div>Please come again</div>
          <br>
          <div>This serves as your OFFICIAL RECEIPT</div>
          <div>VAT Reg TIN: 123-456-789-000</div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    // Trigger print after content is rendered; onload may not fire after document.write/close in some browsers
    const triggerPrint = () => {
      printWindow.print();
      printWindow.close();
    };
    if (printWindow.document.readyState === "complete") {
      printWindow.focus();
      setTimeout(triggerPrint, 100);
    } else {
      printWindow.onload = () => { printWindow.focus(); setTimeout(triggerPrint, 100); };
    }
  };

  return (
    <AppLayout>
      {/* Compact header */}
      <div className="flex items-center gap-3 mb-4">
        <Link to="/pos">
          <Button variant="ghost" size="icon" aria-label="Back to tables">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">
          {table.area} – Table {table.name}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {table.status === "occupied" ? "Occupied" : "Available"}
          </span>
        </h1>
      </div>

      {isMonitorOnly && (
        <p className="mb-3 text-xs text-amber-700 dark:text-amber-300">
          View only — Staff can add items.
        </p>
      )}
      {!canAddToOrder && canProcessPayment && (
        <p className="mb-3 text-xs text-blue-700 dark:text-blue-300">
          Cashier mode — Process payments.
        </p>
      )}

      {/* Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:h-[calc(100vh-200px)]">
        {/* Left: Products */}
        <div className="lg:col-span-3 space-y-4 overflow-y-auto">
          {/* Categories - buttons */}
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "secondary"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>

          {hasAnySentOrder && canAddToOrder && (
            <p className="text-xs text-muted-foreground">
              Tap &quot;+ New Order&quot; in the order panel to add another round.
            </p>
          )}
          {selectedCategory === "LD" && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Step 1: Select Lady</p>
                {selectedLdLadyForCategory && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setSelectedLdLadyForCategory("")}
                  >
                    Change
                  </Button>
                )}
              </div>
              {ldLadies.length === 0 ? (
                <p className="text-xs text-amber-600">
                  No LD ladies found. Add staff with incentive rate in Staff first.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {ldLadies.map((lady) => (
                    <Button
                      key={lady.id}
                      type="button"
                      size="sm"
                      variant={selectedLdLadyForCategory === lady.id ? "default" : "outline"}
                      onClick={() => setSelectedLdLadyForCategory(lady.id)}
                    >
                      {lady.name}
                    </Button>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {selectedLdLadyProfile
                  ? `Step 2: Choose LD type for ${selectedLdLadyProfile.name}.`
                  : "Step 2: Select LD type after choosing a lady."}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                title={product.name}
                onClick={() => canAddItems && addToOrder(product)}
                disabled={!canAddItems || requiresLdLadySelection}
                className={`p-3 rounded-lg text-left transition-colors min-h-[4rem] ${
                  canAddItems && !requiresLdLadySelection
                    ? "bg-muted/30 hover:bg-muted/60 border border-transparent hover:border-border cursor-pointer"
                    : "bg-muted/20 border border-transparent cursor-default opacity-50"
                }`}
              >
                <p className="text-sm font-medium break-words" title={product.name}>
                  {product.name}
                </p>
                <p className="text-xs text-primary font-semibold mt-0.5">
                  {formatCurrency(product.price)}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Order */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4 flex flex-col h-fit lg:h-[calc(100vh-200px)] lg:sticky lg:top-4">
          {/* Compact order tabs */}
          <div className="flex items-center gap-1.5 mb-3 shrink-0">
            {orderTabs.map((tab, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveTabIndex(idx)}
                className={`min-w-[36px] px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTabIndex === idx
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 hover:bg-muted text-muted-foreground"
                }`}
                title={tab.sent ? `Order #${tab.id}` : "Draft"}
              >
                {tab.sent ? `#${tab.id}` : idx + 1}
              </button>
            ))}
            {canAddToOrder && (
              <button
                type="button"
                onClick={addNewOrderTab}
                className="flex items-center justify-center min-w-[36px] px-2.5 py-1.5 rounded-md text-sm border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary"
                title="New order"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between mb-2 shrink-0">
            <span className="text-sm font-medium">
              {orderSent ? "Sent" : "Adding items"}
            </span>
          </div>

          {/* Order Items - Scrollable */}
          <div className="space-y-2 flex-1 overflow-y-auto mb-4 min-h-0 max-h-[40vh] lg:max-h-none">
            {orderItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {canAddItems ? "Tap products to add to order" : "No items in this order."}
              </p>
            ) : (
              orderItems.map((item) => (
                <div
                  key={`${item.productId}:${item.servedBy ?? ""}`}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    item.isComplimentary 
                      ? "bg-purple-500/10 border border-purple-500/30" 
                      : "bg-background"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p
                        className={`text-sm font-medium break-words ${item.isComplimentary ? "text-purple-600" : ""}`}
                        title={item.name}
                      >
                        {item.name}
                      </p>
                      {item.servedByName && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-violet-500/20 text-violet-700 dark:text-violet-300 shrink-0">
                          <User className="w-3 h-3" />
                          {item.servedByName}
                        </span>
                      )}
                      {item.isComplimentary && (
                        <Gift className="w-3 h-3 text-purple-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.unitPrice)} × {item.quantity}
                      {item.isComplimentary && <span className="ml-1 text-purple-500">(Complimentary)</span>}
                      {item.discount > 0 && <span className="ml-1 text-green-600">(-{formatCurrency(item.discount)})</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canAddItems ? (
                      <>
                        <Button
                          variant={item.isComplimentary ? "default" : "outline"}
                          size="icon"
                          className={`h-6 w-6 ${item.isComplimentary ? "bg-purple-500 hover:bg-purple-600" : ""}`}
                          onClick={() => toggleComplimentary(item.productId, item.servedBy)}
                          title={item.isComplimentary ? "Remove complimentary" : "Mark as complimentary"}
                        >
                          <Gift className="w-3 h-3" />
                        </Button>
                        <Button
                          variant={item.discount > 0 ? "default" : "outline"}
                          size="icon"
                          className={`h-6 w-6 ${item.discount > 0 ? "bg-green-600 hover:bg-green-700" : ""}`}
                          onClick={() => setItemDiscount(item.productId, item.servedBy)}
                          title="Set item discount"
                        >
                          <Percent className="w-3 h-3" />
                        </Button>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.productId, -1, item.servedBy)}
                          >
                            -
                          </Button>
                          <span className="w-6 text-center text-sm">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.productId, 1, item.servedBy)}
                          >
                            +
                          </Button>
                        </div>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">× {item.quantity}</span>
                    )}
                    <span className="font-medium text-sm w-20 text-right">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals - compact */}
          <div className="border-t border-border pt-3 space-y-1 mt-auto shrink-0 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>+ Tax &amp; Service</span>
              <span>{formatCurrency(tax + serviceCharge)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-2 border-t border-border text-base">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
            {hasAnySentOrder && sentTabs.length > 1 && (
              <div className="flex justify-between font-medium pt-1 text-primary text-sm">
                <span>Bill total</span>
                <span>{formatCurrency(combinedTotalBeforeDiscount)}</span>
              </div>
            )}
          </div>

          {/* Actions: Staff sends to dept, Cashier/Admin process payment */}
          {(canSendToDept || canProcessPayment || canRequestVoid) && (
            <div className="grid gap-2 mt-4 shrink-0 grid-cols-1 sm:grid-cols-2">
              {canSendToDept && !orderSent && (
                <Button 
                  variant="secondary" 
                  disabled={orderItems.length === 0}
                  onClick={() => setSendToDeptOpen(true)}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send to Dept
                </Button>
              )}
              {canProcessPayment && (
                <Button 
                  disabled={!hasAnySentOrder || processingPayment} 
                  className="w-full"
                  title={!hasAnySentOrder ? "Send at least one order to departments first" : ""}
                  onClick={handleProcessPayment}
                >
                  {processingPayment ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Process Payment
                    </>
                  )}
                </Button>
              )}
              {canRequestVoid && (
                <Button
                  variant="outline"
                  disabled={!hasAnySentOrder}
                  onClick={handleRequestVoid}
                >
                  Request Void
                </Button>
              )}
            </div>
          )}
          {isMonitorOnly && orderItems.length === 0 && (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Open this table as Staff to add items.
            </p>
          )}
          {!canAddToOrder && canProcessPayment && orderItems.length === 0 && (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Waiting for Staff to add items before you can process payment.
            </p>
          )}
        </div>
      </div>

      {/* Send to Department Modal */}
      <Dialog open={sendToDeptOpen} onOpenChange={setSendToDeptOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5" />
              Send Order to Departments
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Review the receipts that will be printed for each department before sending.
            </p>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* Bar Receipt */}
            {barItems.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <Wine className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-amber-800 dark:text-amber-200">Printing Receipt for Bar</span>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0 h-8"
                    onClick={() => printDeptReceipt("BAR", "Drinks & Beverages", barItems)}
                  >
                    <Printer className="w-4 h-4 mr-1" />
                    Print
                  </Button>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-6 font-mono text-sm">
                  <div className="text-center mb-4">
                    <h3 className="text-xl font-bold tracking-wider">BAR</h3>
                    <p className="text-xs text-muted-foreground">Drinks & Beverages</p>
                  </div>
                  
                  <div className="space-y-1 mb-4 text-xs">
                    <div className="flex justify-between">
                      <span>Order No:</span>
                      <span className="font-semibold">{orderNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date:</span>
                      <span>{now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Time:</span>
                      <span>{now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Area:</span>
                      <span>{table.area}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Table:</span>
                      <span className="font-semibold">Table {table.name}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-gray-300 dark:border-gray-600 pt-3 mb-3">
                    <p className="font-bold mb-2">ITEMS</p>
                    <div className="space-y-2">
                      {barItems.map((item) => (
                        <div key={item.productId} className="flex justify-between">
                          <span>{item.quantity}x {item.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-dashed border-gray-300 dark:border-gray-600 pt-3 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Encoder:</span>
                      <span>{user?.name || "Staff"}</span>
                    </div>
                  </div>

                  <div className="text-center mt-4 text-xs text-muted-foreground">
                    ================================
                  </div>
                </div>
              </div>
            )}

            {/* Kitchen Receipt */}
            {kitchenItems.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-green-500/10 border-b border-green-500/30 px-4 py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <ChefHat className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-800 dark:text-green-200">Printing Receipt for Kitchen</span>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0 h-8"
                    onClick={() => printDeptReceipt("KITCHEN", "Food Orders", kitchenItems)}
                  >
                    <Printer className="w-4 h-4 mr-1" />
                    Print
                  </Button>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-6 font-mono text-sm">
                  <div className="text-center mb-4">
                    <h3 className="text-xl font-bold tracking-wider">KITCHEN</h3>
                    <p className="text-xs text-muted-foreground">Food Orders</p>
                  </div>
                  
                  <div className="space-y-1 mb-4 text-xs">
                    <div className="flex justify-between">
                      <span>Order No:</span>
                      <span className="font-semibold">{orderNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date:</span>
                      <span>{now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Time:</span>
                      <span>{now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Area:</span>
                      <span>{table.area}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Table:</span>
                      <span className="font-semibold">Table {table.name}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-gray-300 dark:border-gray-600 pt-3 mb-3">
                    <p className="font-bold mb-2">ITEMS</p>
                    <div className="space-y-2">
                      {kitchenItems.map((item) => (
                        <div key={item.productId} className="flex justify-between">
                          <span>{item.quantity}x {item.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-dashed border-gray-300 dark:border-gray-600 pt-3 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Encoder:</span>
                      <span>{user?.name || "Staff"}</span>
                    </div>
                  </div>

                  <div className="text-center mt-4 text-xs text-muted-foreground">
                    ================================
                  </div>
                </div>
              </div>
            )}

            {/* LD Receipt (if any) */}
            {ldItems.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-purple-500/10 border-b border-purple-500/30 px-4 py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    <span className="font-medium text-purple-800 dark:text-purple-200">Printing Receipt for LD</span>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0 h-8"
                    onClick={() => printDeptReceipt("LD", "LD Orders", ldItems)}
                  >
                    <Printer className="w-4 h-4 mr-1" />
                    Print
                  </Button>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-6 font-mono text-sm">
                  <div className="text-center mb-4">
                    <h3 className="text-xl font-bold tracking-wider">LD</h3>
                    <p className="text-xs text-muted-foreground">LD Orders</p>
                  </div>
                  
                  <div className="space-y-1 mb-4 text-xs">
                    <div className="flex justify-between">
                      <span>Order No:</span>
                      <span className="font-semibold">{orderNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date:</span>
                      <span>{now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Time:</span>
                      <span>{now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Area:</span>
                      <span>{table.area}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Table:</span>
                      <span className="font-semibold">Table {table.name}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-gray-300 dark:border-gray-600 pt-3 mb-3">
                    <p className="font-bold mb-2">ITEMS</p>
                    <div className="space-y-2">
                      {ldItems.map((item) => (
                        <div key={item.productId} className="flex justify-between">
                          <span>{item.quantity}x {item.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-dashed border-gray-300 dark:border-gray-600 pt-3 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Encoder:</span>
                      <span>{user?.name || "Staff"}</span>
                    </div>
                  </div>

                  <div className="text-center mt-4 text-xs text-muted-foreground">
                    ================================
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex flex-wrap gap-4 text-sm">
              {barItems.length > 0 && (
                <div className="flex items-center gap-2">
                  <Wine className="w-4 h-4 text-amber-600" />
                  <span><strong>{barItems.length}</strong> item(s) to Bar</span>
                </div>
              )}
              {kitchenItems.length > 0 && (
                <div className="flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-green-600" />
                  <span><strong>{kitchenItems.length}</strong> item(s) to Kitchen</span>
                </div>
              )}
              {ldItems.length > 0 && (
                <div className="flex items-center gap-2">
                  <span><strong>{ldItems.length}</strong> item(s) to LD</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setSendToDeptOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmSend}
              disabled={sending}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4 mr-2" />
                  Confirm & Send
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Method Selection Modal */}
      <Dialog open={paymentMethodModalOpen} onOpenChange={setPaymentMethodModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Select Payment Method
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            {/* Left: Order Summary */}
            <div className="bg-muted/30 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold text-sm">RA</span>
                </div>
                <div>
                  <p className="font-semibold">Rabbit Alley</p>
                  <p className="text-xs text-muted-foreground">
                    {sentTabs.length > 1 ? `Table bill (${sentTabs.length} orders)` : `Order #${sentTabs[0]?.id || orderNumber}`}
                  </p>
                </div>
              </div>

              {/* Items - combined from all sent orders */}
              <div className="space-y-3 mb-4 max-h-[350px] overflow-y-auto">
                {combinedItems.map((item, idx) => (
                  <div key={`${item.productId}-${idx}`} className={`flex justify-between text-sm ${item.isComplimentary ? "text-purple-600" : ""}`}>
                    <div>
                      <p className="font-medium flex items-center gap-1">
                        {item.name}
                        {item.isComplimentary && <Gift className="w-3 h-3" />}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Qty: {item.quantity}
                        {item.isComplimentary && " (Compli)"}
                      </p>
                    </div>
                    <p className={`font-medium ${item.isComplimentary ? "line-through" : ""}`}>
                      {formatCurrency(item.subtotal)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Totals - combined */}
              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(combinedSubtotal)}</span>
                </div>
                {combinedComplimentary > 0 && (
                  <div className="flex justify-between text-sm text-purple-600">
                    <span>Less Complimentary</span>
                    <span>-{formatCurrency(combinedComplimentary)}</span>
                  </div>
                )}
                {appliedDiscount && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount ({appliedDiscount.name})</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{serviceLabel}</span>
                  <span>{formatCurrency(discountedServiceCharge)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{taxLabel}</span>
                  <span>{formatCurrency(discountedTax)}</span>
                </div>
                {hasCardSurcharge && (
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>Card Surcharge ({posSettings.cardSurcharge.toFixed(2).replace(/\.00$/, "")}%)</span>
                    <span>+{formatCurrency(cardSurcharge)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(finalTotal)}</span>
                </div>
              </div>
            </div>

            {/* Right: Payment Methods */}
            <div className="space-y-4">
              {/* Payment Method Buttons */}
              <div className={`grid grid-cols-2 gap-3 ${useSplitPayment ? "opacity-50 pointer-events-none" : ""}`}>
                <button type="button" onClick={() => setSelectedPaymentMethod("cash")} className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${selectedPaymentMethod === "cash" ? "border-green-500 bg-green-500/10" : "border-border hover:border-green-500/50"}`}>
                  <Banknote className={`w-6 h-6 ${selectedPaymentMethod === "cash" ? "text-green-500" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${selectedPaymentMethod === "cash" ? "text-green-600" : ""}`}>Cash</span>
                </button>
                <button type="button" onClick={() => setSelectedPaymentMethod("gcash")} className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${selectedPaymentMethod === "gcash" ? "border-blue-500 bg-blue-500/10" : "border-border hover:border-blue-500/50"}`}>
                  <Smartphone className={`w-6 h-6 ${selectedPaymentMethod === "gcash" ? "text-blue-500" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${selectedPaymentMethod === "gcash" ? "text-blue-600" : ""}`}>GCash</span>
                </button>
                <button type="button" onClick={() => setSelectedPaymentMethod("bank")} className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${selectedPaymentMethod === "bank" ? "border-cyan-500 bg-cyan-500/10" : "border-border hover:border-cyan-500/50"}`}>
                  <Building2 className={`w-6 h-6 ${selectedPaymentMethod === "bank" ? "text-cyan-500" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${selectedPaymentMethod === "bank" ? "text-cyan-600" : ""}`}>Bank</span>
                </button>
                <button type="button" onClick={() => setSelectedPaymentMethod("debit")} className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 relative ${selectedPaymentMethod === "debit" ? "border-purple-500 bg-purple-500/10" : "border-border hover:border-purple-500/50"}`}>
                  <CreditCard className={`w-6 h-6 ${selectedPaymentMethod === "debit" ? "text-purple-500" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${selectedPaymentMethod === "debit" ? "text-purple-600" : ""}`}>Debit</span>
                  <span className="absolute top-1 right-1 text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-600">
                    +{posSettings.cardSurcharge.toFixed(2).replace(/\.00$/, "")}%
                  </span>
                </button>
                <button type="button" onClick={() => setSelectedPaymentMethod("credit")} className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 relative ${selectedPaymentMethod === "credit" ? "border-orange-500 bg-orange-500/10" : "border-border hover:border-orange-500/50"}`}>
                  <CreditCard className={`w-6 h-6 ${selectedPaymentMethod === "credit" ? "text-orange-500" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${selectedPaymentMethod === "credit" ? "text-orange-600" : ""}`}>Credit</span>
                  <span className="absolute top-1 right-1 text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-600">
                    +{posSettings.cardSurcharge.toFixed(2).replace(/\.00$/, "")}%
                  </span>
                </button>
                <button type="button" onClick={() => setChargeAuthModalOpen(true)} className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 col-span-2 ${selectedPaymentMethod === "charge" ? "border-amber-600 bg-amber-500/10" : "border-border hover:border-amber-500/50"}`}>
                  <Receipt className={`w-6 h-6 ${selectedPaymentMethod === "charge" ? "text-amber-600" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${selectedPaymentMethod === "charge" ? "text-amber-700" : ""}`}>Charge / Utang</span>
                  <span className="text-[9px] text-muted-foreground">Manager auth required</span>
                </button>
              </div>

              {/* Amount Tendered (for Cash) */}
              {!useSplitPayment && selectedPaymentMethod === "charge" && chargeCustomerName && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Charge / Utang</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">Customer: {chargeCustomerName}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-red-500 hover:text-red-600"
                      onClick={() => { setSelectedPaymentMethod("cash"); setChargeCustomerName(""); }}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              )}
              {!useSplitPayment && selectedPaymentMethod === "cash" && (
                <div className="space-y-3 p-4 bg-muted/30 rounded-xl">
                  <label className="text-sm font-medium">Amount Tendered</label>
                  <Input
                    type="number"
                    placeholder="Enter amount..."
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value)}
                    className="text-lg font-semibold"
                  />
                  {amountTendered && parseFloat(amountTendered) >= finalTotal && (
                    <div className="flex justify-between text-sm pt-2 border-t border-border">
                      <span className="text-muted-foreground">Change</span>
                      <span className="font-bold text-green-600">{formatCurrency(change)}</span>
                    </div>
                  )}
                  {amountTendered && parseFloat(amountTendered) < finalTotal && (
                    <p className="text-xs text-red-500">Amount is less than total</p>
                  )}
                  
                  {/* Quick Amount Buttons */}
                  <div className="grid grid-cols-4 gap-2 pt-2">
                    {[100, 200, 500, 1000].map((amt) => (
                      <Button
                        key={amt}
                        variant="outline"
                        size="sm"
                        onClick={() => setAmountTendered(String(amt))}
                      >
                        ₱{amt}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setAmountTendered(String(Math.ceil(finalTotal / 100) * 100))}
                  >
                    Exact Amount ({formatCurrency(Math.ceil(finalTotal / 100) * 100)})
                  </Button>
                </div>
              )}

              {/* Multiple Payment / Split */}
              <div className="p-4 bg-muted/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Multiple Payment (Split)</span>
                  <Button
                    variant={useSplitPayment ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setUseSplitPayment((prev) => !prev);
                      setSelectedPaymentMethod("cash");
                      setChargeCustomerName("");
                    }}
                  >
                    {useSplitPayment ? "On" : "Off"}
                  </Button>
                </div>
                {useSplitPayment && (
                  <div className="space-y-2">
                    {sentTabs.length !== 1 ? (
                      <p className="text-xs text-amber-600">
                        Split payment is currently available for one sent order only.
                      </p>
                    ) : (
                      <>
                        {splitPayments.map((split, idx) => (
                          <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={split.amount}
                              onChange={(e) =>
                                setSplitPayments((prev) =>
                                  prev.map((row, rowIdx) =>
                                    rowIdx === idx ? { ...row, amount: e.target.value } : row
                                  )
                                )
                              }
                              placeholder="Amount"
                            />
                            <select
                              value={split.method}
                              onChange={(e) =>
                                setSplitPayments((prev) =>
                                  prev.map((row, rowIdx) =>
                                    rowIdx === idx ? { ...row, method: e.target.value as SplitMethod } : row
                                  )
                                )
                              }
                              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="cash">Cash</option>
                              <option value="gcash">GCash</option>
                              <option value="bank">Bank</option>
                            </select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10"
                              disabled={splitPayments.length <= 2}
                              onClick={() =>
                                setSplitPayments((prev) => prev.filter((_, rowIdx) => rowIdx !== idx))
                              }
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() =>
                            setSplitPayments((prev) => [...prev, { amount: "", method: "cash" }])
                          }
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add split
                        </Button>
                        <p className={`text-xs ${Math.abs(splitRemaining) < 0.01 ? "text-green-600" : "text-amber-600"}`}>
                          {Math.abs(splitRemaining) < 0.01
                            ? "Split total matches payable amount."
                            : `Remaining: ${formatCurrency(splitRemaining)}`}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Discount Section */}
              <div className="p-4 bg-muted/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Discount
                  </span>
                  {appliedDiscount ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => setAppliedDiscount(null)}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Remove
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => setDiscountModalOpen(true)}
                      >
                        <Percent className="w-3 h-3 mr-1" />
                        Apply Discount
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => {
                          const amountRaw = window.prompt("Enter exact discount amount:");
                          if (amountRaw === null) return;
                          const amount = Number(amountRaw);
                          if (!Number.isFinite(amount) || amount <= 0) {
                            toast.error("Enter a valid discount amount");
                            return;
                          }
                          if (amount > combinedChargeable) {
                            toast.error("Discount cannot exceed subtotal");
                            return;
                          }
                          const exactDiscount = {
                            id: "exact_amount",
                            name: "Exact Amount",
                            type: "Applied",
                            value: String(amount),
                          };
                          if (canApproveDiscounts) {
                            setAppliedDiscount(exactDiscount);
                          } else {
                            setPendingDiscount(exactDiscount);
                            setManagerAuthModalOpen(true);
                            setManagerEmployeeId("");
                            setManagerPassword("");
                            setManagerAuthError(null);
                          }
                        }}
                      >
                        Exact Amount
                      </Button>
                    </div>
                  )}
                </div>
                {appliedDiscount && (
                  <div className="flex items-center justify-between p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">{appliedDiscount.name}</p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        {appliedDiscount.value.includes("%") ? appliedDiscount.value : `₱${appliedDiscount.value}`} off
                      </p>
                    </div>
                    <span className="text-sm font-bold text-green-600">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
              </div>

              {/* Card Surcharge Notice */}
              {hasCardSurcharge && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    A {posSettings.cardSurcharge.toFixed(2).replace(/\.00$/, "")}% surcharge ({formatCurrency(cardSurcharge)}) will be added for card payments.
                  </p>
                </div>
              )}

              {/* Confirm Button */}
              <Button
                className="w-full h-12 text-lg"
                onClick={handleConfirmPayment}
                disabled={
                  (useSplitPayment && (!splitValid || sentTabs.length !== 1)) ||
                  (!useSplitPayment && selectedPaymentMethod === "cash" && (!amountTendered || parseFloat(amountTendered) < finalTotal)) ||
                  (!useSplitPayment && selectedPaymentMethod === "charge" && !chargeCustomerName.trim())
                }
              >
                Pay Now - {formatCurrency(finalTotal)}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discount Selection Modal */}
      <Dialog open={discountModalOpen} onOpenChange={setDiscountModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Select Discount
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 mt-4 max-h-[400px] overflow-y-auto">
            {availableDiscounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No discounts available
              </p>
            ) : (
              availableDiscounts.map((discount) => (
                <button
                  key={discount.id}
                  type="button"
                  onClick={() => {
                    if (canApproveDiscounts) {
                      setAppliedDiscount(discount);
                      setDiscountModalOpen(false);
                    } else {
                      setPendingDiscount(discount);
                      setDiscountModalOpen(false);
                      setManagerAuthModalOpen(true);
                      setManagerEmployeeId("");
                      setManagerPassword("");
                      setManagerAuthError(null);
                    }
                  }}
                  className="w-full p-4 rounded-xl border-2 border-border hover:border-green-500 hover:bg-green-500/5 transition-all text-left flex items-center justify-between group"
                >
                  <div>
                    <p className="font-medium group-hover:text-green-600">{discount.name}</p>
                    {discount.category && (
                      <p className="text-xs text-muted-foreground">{discount.category}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">
                      {discount.value.includes("%") ? discount.value : `₱${discount.value}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {discount.value.includes("%") ? "off subtotal" : "fixed discount"}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDiscountModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Charge / Utang Authorization Modal - Manager + Customer Name required */}
      <Dialog open={chargeAuthModalOpen} onOpenChange={(open) => { setChargeAuthModalOpen(open); if (!open) setChargeAuthCustomerName(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Charge / Utang – Manager Authorization
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Manager must authorize and enter customer name for charge/credit payment.
          </p>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">Manager Employee ID</label>
              <Input
                value={managerEmployeeId}
                onChange={(e) => { setManagerEmployeeId(e.target.value); setManagerAuthError(null); }}
                placeholder="e.g. MGR001"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Manager Password</label>
              <Input
                type="password"
                value={managerPassword}
                onChange={(e) => { setManagerPassword(e.target.value); setManagerAuthError(null); }}
                placeholder="Enter manager password"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Customer Name *</label>
              <Input
                value={chargeAuthCustomerName}
                onChange={(e) => { setChargeAuthCustomerName(e.target.value); setManagerAuthError(null); }}
                placeholder="e.g. Juan Dela Cruz"
                className="mt-1"
              />
            </div>
            {managerAuthError && <p className="text-sm text-destructive">{managerAuthError}</p>}
          </div>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" className="flex-1" onClick={() => { setChargeAuthModalOpen(false); setChargeAuthCustomerName(""); }}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={!managerEmployeeId.trim() || !managerPassword || !chargeAuthCustomerName.trim() || managerAuthLoading}
              onClick={async () => {
                setManagerAuthLoading(true);
                setManagerAuthError(null);
                try {
                  await api.auth.verifyManager(managerEmployeeId.trim(), managerPassword, { action: "charge", customerName: chargeAuthCustomerName.trim() });
                  setSelectedPaymentMethod("charge");
                  setChargeCustomerName(chargeAuthCustomerName.trim());
                  setChargeAuthModalOpen(false);
                  setChargeAuthCustomerName("");
                  setManagerEmployeeId("");
                  setManagerPassword("");
                  toast.success("Charge authorized");
                } catch (e) {
                  setManagerAuthError(e instanceof Error ? e.message : "Authorization failed");
                } finally {
                  setManagerAuthLoading(false);
                }
              }}
            >
              {managerAuthLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verifying…
                </span>
              ) : (
                "Verify & Proceed"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* LD / Ladies Drink - Select Lady Modal */}
      <Dialog open={ladyModalOpen} onOpenChange={(open) => { setLadyModalOpen(open); if (!open) setPendingLdProduct(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Select Lady
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Assign this LD drink to a lady for incentive tracking.
          </p>
          {pendingLdProduct && (
            <p className="text-sm font-medium">
              {pendingLdProduct.name} — {formatCurrency(pendingLdProduct.price)}
            </p>
          )}
          <div className="space-y-2 mt-3">
            <label className="text-sm font-medium">Lady</label>
            <select
              value={selectedLady}
              onChange={(e) => setSelectedLady(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— Select —</option>
              {ldLadies.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
            {ldLadies.length === 0 && (
              <p className="text-xs text-amber-600">No LD ladies. Add staff with incentive rate in Staff.</p>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => { setLadyModalOpen(false); setPendingLdProduct(null); }}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={!selectedLady}
              onClick={() => {
                if (!pendingLdProduct || !selectedLady) return;
                const lady = ldLadies.find((l) => l.id === selectedLady);
                doAddToOrder(pendingLdProduct, selectedLady, lady?.name);
                setSelectedLdLadyForCategory(selectedLady);
                setLadyModalOpen(false);
                setPendingLdProduct(null);
                setSelectedLady("");
              }}
            >
              Add to Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manager Authorization Modal (when Cashier applies discount) */}
      <Dialog
        open={managerAuthModalOpen}
        onOpenChange={(open) => {
          setManagerAuthModalOpen(open);
          if (!open) setPendingDiscount(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Manager Authorization
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Manager must enter credentials to apply discount
            {pendingDiscount && (
              <span className="block mt-2 font-medium text-foreground">
                Discount: {pendingDiscount.name}
              </span>
            )}
          </p>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">Manager Employee ID</label>
              <Input
                value={managerEmployeeId}
                onChange={(e) => {
                  setManagerEmployeeId(e.target.value);
                  setManagerAuthError(null);
                }}
                placeholder="e.g. MGR001"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                value={managerPassword}
                onChange={(e) => {
                  setManagerPassword(e.target.value);
                  setManagerAuthError(null);
                }}
                placeholder="Enter manager password"
                className="mt-1"
              />
            </div>
            {managerAuthError && (
              <p className="text-sm text-destructive">{managerAuthError}</p>
            )}
          </div>
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setManagerAuthModalOpen(false);
                setPendingDiscount(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={!managerEmployeeId.trim() || !managerPassword || managerAuthLoading}
              onClick={async () => {
                if (!pendingDiscount) return;
                setManagerAuthLoading(true);
                setManagerAuthError(null);
                try {
                  await api.auth.verifyManager(managerEmployeeId.trim(), managerPassword, { discountName: pendingDiscount.name, discountId: pendingDiscount.id });
                  setAppliedDiscount(pendingDiscount);
                  setPendingDiscount(null);
                  setManagerAuthModalOpen(false);
                  setManagerEmployeeId("");
                  setManagerPassword("");
                  toast.success("Discount applied");
                } catch (e) {
                  setManagerAuthError(e instanceof Error ? e.message : "Authorization failed");
                } finally {
                  setManagerAuthLoading(false);
                }
              }}
            >
              {managerAuthLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verifying…
                </span>
              ) : (
                "Verify & Apply"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Processing Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-md [&>button]:hidden">
          <VisuallyHidden>
            <DialogTitle>Payment Processing</DialogTitle>
          </VisuallyHidden>
          <div className="flex flex-col items-center">
            {/* Status Header */}
            <div className="mb-6 text-center">
              {paymentStep === "processing" && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <CreditCard className="w-8 h-8 text-blue-500 animate-pulse" />
                  </div>
                  <h3 className="text-lg font-semibold">Processing Payment</h3>
                  <p className="text-sm text-muted-foreground">Please wait...</p>
                </>
              )}
              {paymentStep === "printing" && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center relative">
                    <Printer className="w-8 h-8 text-amber-500" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full animate-ping" />
                  </div>
                  <h3 className="text-lg font-semibold">Printing Receipt</h3>
                  <p className="text-sm text-muted-foreground">LogicOwl OJ-8030 (80mm)</p>
                </>
              )}
              {paymentStep === "done" && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-green-600">Payment Complete!</h3>
                  <p className="text-sm text-muted-foreground mb-2">Print the receipt or close to finish.</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mb-4 px-3 py-2 bg-amber-50 dark:bg-amber-950/50 rounded border border-amber-200 dark:border-amber-800">
                    In the print dialog, set <strong>Destination</strong> to your receipt printer (e.g. XP-80C), not &quot;Microsoft Print to PDF&quot;.
                  </p>
                  <div className="flex gap-3 justify-center flex-wrap">
                    <Button
                      type="button"
                      onClick={() => {
                        if (lastReceiptForPrint) {
                          printReceiptViaBrowser(lastReceiptForPrint);
                          toast.info("In the print dialog, change Destination from «Microsoft Print to PDF» to your receipt printer (e.g. XP-80C).", { duration: 6000 });
                        }
                      }}
                      disabled={!lastReceiptForPrint}
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Print receipt
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setPaymentModalOpen(false);
                        setLastReceiptForPrint(null);
                        navigate("/pos");
                      }}
                    >
                      Done
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Receipt Preview - 80mm Thermal Style */}
            <div className={`w-full bg-white dark:bg-zinc-950 border border-border rounded-lg overflow-hidden transition-all duration-500 ${paymentStep === "printing" ? "animate-pulse" : ""}`}>
              {/* Printing Animation Overlay */}
              {paymentStep === "printing" && (
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/5 to-transparent animate-[scan_1.5s_ease-in-out_infinite]" />
              )}
              
              {/* Receipt Content - 80mm style (48 chars width) */}
              <div className="p-4 font-mono text-xs leading-relaxed relative">
                {/* Header */}
                <div className="text-center border-b border-dashed border-gray-300 dark:border-gray-700 pb-3 mb-3">
                  <p className="text-base font-bold tracking-wider">RABBIT ALLEY</p>
                  <p className="text-[10px] text-muted-foreground">Bar & Restaurant</p>
                  <p className="text-[10px] text-muted-foreground mt-1">123 Main Street, City</p>
                  <p className="text-[10px] text-muted-foreground">Tel: (02) 123-4567</p>
                </div>

                {/* Order Info */}
                <div className="border-b border-dashed border-gray-300 dark:border-gray-700 pb-3 mb-3 space-y-1">
                  <div className="flex justify-between">
                    <span>Order #:</span>
                    <span className="font-semibold">{sentTabs[0]?.id || orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span>{now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Time:</span>
                    <span>{now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Table:</span>
                    <span>{table?.area} - {table?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cashier:</span>
                    <span>{user?.name || "Staff"}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="border-b border-dashed border-gray-300 dark:border-gray-700 pb-3 mb-3">
                  <p className="font-bold mb-2">ITEMS</p>
                  <div className="space-y-1">
                    {orderItems.slice(0, 6).map((item) => (
                      <div key={item.productId} className="flex justify-between gap-2">
                        <span className="flex-1 min-w-0 break-words text-left pr-2">
                          {item.quantity}x {item.name}
                        </span>
                        <span className="shrink-0">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                    {orderItems.length > 6 && (
                      <p className="text-center text-muted-foreground">... +{orderItems.length - 6} more items</p>
                    )}
                  </div>
                </div>

                {/* Totals */}
                <div className="space-y-1 border-b border-dashed border-gray-300 dark:border-gray-700 pb-3 mb-3">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {complimentaryTotal > 0 && (
                    <div className="flex justify-between">
                      <span>Less Compli:</span>
                      <span>-{formatCurrency(complimentaryTotal)}</span>
                    </div>
                  )}
                  {appliedDiscount && (
                    <div className="flex justify-between">
                      <span>Discount:</span>
                      <span>-{formatCurrency(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>{serviceLabel}:</span>
                    <span>{formatCurrency(discountedServiceCharge)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{taxLabel}:</span>
                    <span>{formatCurrency(discountedTax)}</span>
                  </div>
                  {hasCardSurcharge && (
                    <div className="flex justify-between">
                      <span>Card Fee ({posSettings.cardSurcharge.toFixed(2).replace(/\.00$/, "")}%):</span>
                      <span>{formatCurrency(cardSurcharge)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm pt-1">
                    <span>TOTAL:</span>
                    <span>{formatCurrency(finalTotal)}</span>
                  </div>
                </div>

                {/* Payment Info */}
                <div className="border-b border-dashed border-gray-300 dark:border-gray-700 pb-3 mb-3">
                  <div className="flex justify-between">
                    <span>Payment:</span>
                    <span>{useSplitPayment ? "SPLIT" : selectedPaymentMethod.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Amount Paid:</span>
                    <span>{formatCurrency(!useSplitPayment && selectedPaymentMethod === "cash" ? parseFloat(amountTendered) || finalTotal : finalTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Change:</span>
                    <span>{formatCurrency(!useSplitPayment && selectedPaymentMethod === "cash" ? change : 0)}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="text-center text-[10px] text-muted-foreground space-y-1">
                  <p>================================</p>
                  <p className="font-semibold">Thank you for dining with us!</p>
                  <p>Please come again</p>
                  <p>================================</p>
                  <p className="mt-2">This serves as your OFFICIAL RECEIPT</p>
                  <p>VAT Reg TIN: 123-456-789-000</p>
                </div>

                {/* Printing line animation */}
                {paymentStep === "printing" && (
                  <div className="absolute left-0 right-0 h-0.5 bg-amber-500 animate-[printLine_1.5s_ease-in-out_infinite]" style={{ top: "var(--print-line-pos, 0)" }} />
                )}
              </div>
            </div>

            {/* Printer Info */}
            {paymentStep === "printing" && (
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Connected to OJ-8030 Printer</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes scan {
          0%, 100% { transform: translateY(-100%); }
          50% { transform: translateY(100%); }
        }
        @keyframes printLine {
          0% { top: 0; opacity: 1; }
          100% { top: 100%; opacity: 0.5; }
        }
      `}</style>
    </AppLayout>
  );
}
