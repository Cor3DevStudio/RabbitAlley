import { useCallback, useEffect, useState, memo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/dashboard/StatCard";
import { FileText, FileSpreadsheet, File, Filter, Calculator, ShoppingBag, DollarSign, Percent, Receipt, Users, CheckCircle, Printer, Download, Plus, ChevronDown, X, Eye, MapPin, Clock, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type ReportTab = "sales" | "payroll";

interface OrderRow {
  id: string;
  area: string;
  table: string;
  employee: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: string;
  time: string;
}

export interface BreakdownItem {
  title: string;
  amount: number;
}

interface PayrollRow {
  id: string;
  employeeId: string;
  name: string;
  timeIn?: string | null;
  budget: number;
  commission: number;
  ldCount?: number;
  /** Total LD sales amount (sum of LD drink prices for this lady) */
  ldAmount?: number;
  incentives: number;
  adjustments: number;
  deductions: number;
  incentivesBreakdown?: BreakdownItem[] | null;
  adjustmentsBreakdown?: BreakdownItem[] | null;
  deductionsBreakdown?: BreakdownItem[] | null;
  netPayout: number;
  status: string;
  approvedBy: string | null;
}

const today = new Date().toISOString().split("T")[0];


/** Format period (dateFrom, dateTo) as "Salary Slip for July 2025" */
function getSalarySlipMonthYear(dateFrom: string, dateTo: string): string {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const d = dateTo ? new Date(dateTo) : new Date(dateFrom);
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Convert number to words for "Amount in Words" (e.g. 53500 -> "Fifty Three Thousand Five Hundred") */
function numberToWords(n: number): string {
  const int = Math.round(Math.abs(n));
  if (int === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function to99(x: number): string {
    if (x < 10) return ones[x];
    if (x < 20) return teens[x - 10];
    const t = Math.floor(x / 10), o = x % 10;
    return tens[t] + (o ? " " + ones[o] : "");
  }
  function to999(x: number): string {
    if (x < 100) return to99(x);
    const h = Math.floor(x / 100), r = x % 100;
    return ones[h] + " Hundred" + (r ? " " + to99(r) : "");
  }
  if (int < 1000) return to999(int);
  if (int < 1_000_000) {
    const th = Math.floor(int / 1000), r = int % 1000;
    return to999(th) + " Thousand" + (r ? " " + to999(r) : "");
  }
  const m = Math.floor(int / 1_000_000), r = int % 1_000_000;
  return to999(m) + " Million" + (r ? " " + numberToWords(r) : "");
}

interface PayrollTableRowProps {
  row: PayrollRow;
  onUpdateBreakdown: (row: PayrollRow, field: "incentives" | "adjustments" | "deductions", breakdown: BreakdownItem[]) => void;
  onApprove: (row: PayrollRow) => void;
  onPrintPayslip: (row: PayrollRow) => void;
  onDownloadPayslipPdf: (row: PayrollRow) => void;
  onPrintPayslipThermal: (row: PayrollRow) => void;
}

function BreakdownCell({
  total,
  breakdown,
  field,
  onUpdate,
  variant,
  disabled,
}: {
  total: number;
  breakdown: BreakdownItem[] | null | undefined;
  field: "incentives" | "adjustments" | "deductions";
  onUpdate: (b: BreakdownItem[]) => void;
  variant: "incentive" | "adjustment" | "deduction";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const items = Array.isArray(breakdown) && breakdown.length > 0 ? breakdown : total !== 0 ? [{ title: "Other", amount: total }] : [];
  const variantCls = variant === "incentive" ? "text-green-600" : variant === "deduction" ? "text-destructive" : "";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex items-center justify-end gap-1 w-full min-w-[88px] px-2 py-1.5 rounded-md text-right font-medium hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
            variantCls
          )}
        >
          <span>{formatCurrency(total)}</span>
          {items.length > 0 && <ChevronDown className="w-3 h-3 opacity-60" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {field === "incentives" ? "Incentives" : field === "adjustments" ? "Adjustments" : "Deductions"} breakdown
          </p>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
                <span className="truncate text-muted-foreground">{item.title || "—"}</span>
                <div className="flex items-center gap-1">
                  <span className={cn("font-medium tabular-nums", variant === "deduction" && "text-destructive")}>
                    {formatCurrency(item.amount)}
                  </span>
                  {!disabled && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        const next = [...items];
                        next.splice(i, 1);
                        onUpdate(next.map((x) => ({ title: x.title, amount: x.amount })));
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!disabled && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder="Title"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  className="h-8 w-20 text-sm"
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => {
                  const amt = parseFloat(addAmount) || 0;
                  if (!addTitle.trim() && amt === 0) return;
                  const base = Array.isArray(breakdown) && breakdown.length > 0 ? breakdown : (total ? [{ title: "Other", amount: total }] : []);
                  onUpdate([...base, { title: addTitle.trim() || "Other", amount: amt }]);
                  setAddTitle("");
                  setAddAmount("");
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add {field === "incentives" ? "incentive" : field === "adjustments" ? "adjustment" : "deduction"}
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const PayrollTableRow = memo(function PayrollTableRow({
  row,
  onUpdateBreakdown,
  onApprove,
  onPrintPayslip,
  onDownloadPayslipPdf,
  onPrintPayslipThermal,
}: PayrollTableRowProps) {
  const disabled = row.status === "approved";
  const otherIncentivesTotal = Array.isArray(row.incentivesBreakdown) ? row.incentivesBreakdown.reduce((s, x) => s + (x.amount ?? 0), 0) : 0;
  return (
    <TableRow>
      <TableCell className="font-medium">{row.name}</TableCell>
      <TableCell className="font-mono text-xs">{row.employeeId}</TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground text-sm">{row.timeIn ?? "—"}</TableCell>
      <TableCell className="text-right">{formatCurrency(row.budget)}</TableCell>
      <TableCell className="text-center font-semibold tabular-nums">{row.ldCount ?? 0}</TableCell>
      <TableCell className="text-right">{formatCurrency((row.ldCount ?? 0) * 100)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatCurrency(row.incentives)}</TableCell>
      <TableCell className="p-1">
        <BreakdownCell
          total={otherIncentivesTotal}
          breakdown={row.incentivesBreakdown}
          field="incentives"
          variant="incentive"
          disabled={disabled}
          onUpdate={(b) => onUpdateBreakdown(row, "incentives", b)}
        />
      </TableCell>
      <TableCell className="p-1">
        <BreakdownCell
          total={row.adjustments}
          breakdown={row.adjustmentsBreakdown}
          field="adjustments"
          variant="adjustment"
          disabled={disabled}
          onUpdate={(b) => onUpdateBreakdown(row, "adjustments", b)}
        />
      </TableCell>
      <TableCell className="p-1">
        <BreakdownCell
          total={row.deductions}
          breakdown={row.deductionsBreakdown}
          field="deductions"
          variant="deduction"
          disabled={disabled}
          onUpdate={(b) => onUpdateBreakdown(row, "deductions", b)}
        />
      </TableCell>
      <TableCell className="text-right font-semibold">{formatCurrency(row.netPayout)}</TableCell>
      <TableCell>
        <Badge className={cn(
          row.status === "approved"
            ? "bg-success/20 text-success border-success/30"
            : "bg-warning/20 text-warning border-warning/30"
        )}>
          {row.status}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1 items-center">
          {row.status === "draft" && (
            <Button size="sm" className="bg-success hover:bg-success/90" onClick={() => onApprove(row)}>
              Approve
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onPrintPayslip(row)} title="Print (browser)">
            <Printer className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDownloadPayslipPdf(row)} title="Download PDF">
            <Download className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => onPrintPayslipThermal(row)} title="Print to thermal">
            Thermal
          </Button>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">{row.approvedBy ?? "—"}</TableCell>
    </TableRow>
  );
});

export default function Reports() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ReportTab>("sales");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [salesList, setSalesList] = useState<OrderRow[]>([]);
  const [salesSummary, setSalesSummary] = useState({ totalOrders: 0, totalSales: 0, totalDiscounts: 0, totalTax: 0 });
  const [payroll, setPayroll] = useState<PayrollRow[]>([]);
  const [payrollSummary, setPayrollSummary] = useState({ totalEmployees: 0, totalPayout: 0, totalIncentives: 0, totalDeductions: 0, totalLd: 0 });
  const [loadingSales, setLoadingSales] = useState(false);
  const [loadingPayroll, setLoadingPayroll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [computeModalOpen, setComputeModalOpen] = useState(false);
  const [computeProgress, setComputeProgress] = useState(0);
  const [computeStep, setComputeStep] = useState("");
  const [orderDetail, setOrderDetail] = useState<Awaited<ReturnType<typeof api.orders.detail>> | null>(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);

  const loadSalesStable = useCallback(async () => {
    if (dateFrom > dateTo) return;
    setLoadingSales(true);
    setError(null);
    try {
      const res = await api.reports.sales(dateFrom, dateTo);
      setSalesList(res.list);
      setSalesSummary(res.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sales report");
    } finally {
      setLoadingSales(false);
    }
  }, [dateFrom, dateTo]);

  const loadPayrollStable = useCallback(async () => {
    if (dateFrom > dateTo) return;
    setLoadingPayroll(true);
    setError(null);
    try {
      const list = await api.reports.payroll(dateFrom, dateTo);
      const mappedPayroll = list.map((p) => {
        const incB = (p as { incentivesBreakdown?: BreakdownItem[] }).incentivesBreakdown ?? null;
        const otherInc = Array.isArray(incB) ? incB.reduce((s, x) => s + (x.amount ?? 0), 0) : 0;
        const budget = Number(p.allowance ?? 0);
        const ldCount = Number((p as { ldCount?: number }).ldCount ?? 0);
        const commission = ldCount * 100;
        const incentives = Number(p.incentives ?? 0);
        const adjustments = Number(p.adjustments ?? 0);
        const deductions = Number(p.deductions ?? 0);
        const netPayout = budget + commission + incentives + otherInc + adjustments - deductions;
        return {
          id: p.id,
          employeeId: p.employeeId ?? "",
          name: p.name,
          timeIn: (p as { timeIn?: string | null }).timeIn ?? null,
          budget,
          commission,
          ldCount,
          ldAmount: Number((p as { ldAmount?: number }).ldAmount ?? 0),
          incentives,
          adjustments,
          deductions,
          incentivesBreakdown: incB,
          adjustmentsBreakdown: (p as { adjustmentsBreakdown?: BreakdownItem[] }).adjustmentsBreakdown ?? null,
          deductionsBreakdown: (p as { deductionsBreakdown?: BreakdownItem[] }).deductionsBreakdown ?? null,
          netPayout,
          status: p.status ?? "draft",
          approvedBy: p.approvedBy ?? null,
        };
      });
      setPayroll(mappedPayroll);
      const summary = mappedPayroll.reduce(
        (acc, row) => {
          const calculatedPayout = row.budget + row.commission + row.incentives + row.adjustments - row.deductions;
          return {
            totalEmployees: acc.totalEmployees + 1,
            totalPayout: acc.totalPayout + calculatedPayout,
            totalIncentives: acc.totalIncentives + row.incentives,
            totalDeductions: acc.totalDeductions + row.deductions,
            totalLd: acc.totalLd + (row.ldCount ?? 0),
          };
        },
        { totalEmployees: 0, totalPayout: 0, totalIncentives: 0, totalDeductions: 0, totalLd: 0 }
      );
      setPayrollSummary(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payroll report");
    } finally {
      setLoadingPayroll(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (activeTab === "sales") loadSalesStable();
    else if (activeTab === "payroll") loadPayrollStable();
  }, [activeTab, dateFrom, dateTo, loadSalesStable, loadPayrollStable]);

  const handleViewOrder = useCallback(async (orderId: string) => {
    setOrderDetailLoading(true);
    setOrderDetail(null);
    try {
      const detail = await api.orders.detail(orderId);
      setOrderDetail(detail);
    } catch {
      toast.error("Failed to load order details");
    } finally {
      setOrderDetailLoading(false);
    }
  }, []);

  const handleFilter = useCallback(() => {
    if (dateFrom > dateTo) {
      toast.error("From date must be before or equal to To date");
      return;
    }
    if (activeTab === "sales") loadSalesStable();
    else loadPayrollStable();
    toast.success(`Filtered from ${dateFrom} to ${dateTo}`);
  }, [activeTab, dateFrom, dateTo, loadSalesStable, loadPayrollStable]);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = useCallback((format: "PDF" | "Excel" | "CSV") => {
    const fromTo = `${dateFrom}_to_${dateTo}`;
    try {
      if (activeTab === "sales") {
        if (format === "CSV") {
          const headers = ["Order No", "Area", "Table", "Employee", "Subtotal", "Discount", "Tax", "Total", "Status", "Time"];
          const rows = salesList.map((o) => [o.id, o.area, o.table, o.employee, o.subtotal, o.discount, o.tax, o.total, o.status, o.time]);
          const csv = [headers.join(","), ...rows.map((r) => r.map((c) => (typeof c === "string" && c.includes(",") ? `"${c}"` : c)).join(","))].join("\n");
          const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
          downloadBlob(blob, `sales_report_${fromTo}.csv`);
        } else if (format === "Excel") {
          const ws = XLSX.utils.json_to_sheet(
            salesList.map((o) => ({
              "Order No": o.id,
              Area: o.area,
              Table: o.table,
              Employee: o.employee,
              Subtotal: o.subtotal,
              Discount: o.discount,
              Tax: o.tax,
              Total: o.total,
              Status: o.status,
              Time: o.time,
            }))
          );
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Sales");
          XLSX.writeFile(wb, `sales_report_${fromTo}.xlsx`);
        } else {
          const doc = new jsPDF({ orientation: "landscape" });
          doc.setFontSize(14);
          doc.text(`Sales Report ${dateFrom} to ${dateTo}`, 14, 12);
          doc.setFontSize(10);
          doc.text(`Total Orders: ${salesSummary.totalOrders}  |  Total Sales: ₱${salesSummary.totalSales.toFixed(2)}  |  Total Discount: ₱${salesSummary.totalDiscounts.toFixed(2)}  |  Tax: ₱${salesSummary.totalTax.toFixed(2)}`, 14, 20);
          autoTable(doc, {
            startY: 24,
            head: [["Order No", "Area", "Table", "Employee", "Subtotal", "Discount", "Tax", "Total", "Status", "Time"]],
            body: salesList.map((o) => [o.id, o.area, o.table, o.employee, o.subtotal.toFixed(2), o.discount.toFixed(2), o.tax.toFixed(2), o.total.toFixed(2), o.status, o.time]),
          });
          const summaryY = ((doc as unknown) as { lastAutoTable?: { finalY: number } }).lastAutoTable
            ? ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
            : 100;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.text(`TOTAL: ₱${salesSummary.totalSales.toFixed(2)}`, 14, summaryY);
          doc.text(`TOTAL DISCOUNT: ₱${salesSummary.totalDiscounts.toFixed(2)}`, 14, summaryY + 7);
          doc.setFont("helvetica", "normal");
          doc.save(`sales_report_${fromTo}.pdf`);
        }
      } else {
        if (format === "CSV") {
          const otherInc = (p: PayrollRow) => Array.isArray(p.incentivesBreakdown) ? p.incentivesBreakdown.reduce((s, x) => s + x.amount, 0) : 0;
          const headers = ["Employee ID", "Name", "Time In", "Budget", "Total LD", "Total LD Commission", "Incentives", "Other Incentives", "Adjustments", "Deductions", "Net Payout", "Status", "Approved By"];
          const rows = payroll.map((p) => [
            p.employeeId,
            p.name,
            p.timeIn ?? "",
            p.budget,
            p.ldCount ?? 0,
            (p.ldCount ?? 0) * 100,
            p.incentives,
            otherInc(p),
            p.adjustments,
            p.deductions,
            p.netPayout.toFixed(2),
            p.status,
            p.approvedBy ?? "",
          ]);
          const csv = [headers.join(","), ...rows.map((r) => r.map((c) => (typeof c === "string" && c.includes(",") ? `"${c}"` : c)).join(","))].join("\n");
          const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
          downloadBlob(blob, `payroll_report_${fromTo}.csv`);
        } else if (format === "Excel") {
          const otherInc = (p: PayrollRow) => Array.isArray(p.incentivesBreakdown) ? p.incentivesBreakdown.reduce((s, x) => s + x.amount, 0) : 0;
          const ws = XLSX.utils.json_to_sheet(
            payroll.map((p) => ({
              "Employee ID": p.employeeId,
              Name: p.name,
              "Time In": p.timeIn ?? "",
              Budget: p.budget,
              "Total LD": p.ldCount ?? 0,
              "Total LD Commission": (p.ldCount ?? 0) * 100,
              Incentives: p.incentives,
              "Other Incentives": otherInc(p),
              Adjustments: p.adjustments,
              Deductions: p.deductions,
              "Net Payout": p.netPayout,
              Status: p.status,
              "Approved By": p.approvedBy ?? "",
            }))
          );
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Payroll");
          XLSX.writeFile(wb, `payroll_report_${fromTo}.xlsx`);
        } else {
          const doc = new jsPDF({ orientation: "landscape" });
          doc.setFontSize(14);
          doc.text(`Payroll Report ${dateFrom} to ${dateTo}`, 14, 12);
          doc.setFontSize(10);
          doc.text(`Employees: ${payrollSummary.totalEmployees}  |  Total Payout: ₱${payrollSummary.totalPayout.toFixed(2)}  |  Incentives: ₱${payrollSummary.totalIncentives.toFixed(2)}  |  Deductions: ₱${payrollSummary.totalDeductions.toFixed(2)}`, 14, 20);
          const otherInc = (p: PayrollRow) => Array.isArray(p.incentivesBreakdown) ? p.incentivesBreakdown.reduce((s, x) => s + x.amount, 0) : 0;
          autoTable(doc, {
            startY: 24,
            head: [["Employee ID", "Name", "Time In", "Budget", "Total LD", "Comm (₱)", "Incent", "Other Inc", "Adj", "Ded", "Net", "Status"]],
            body: payroll.map((p) => [
              p.employeeId,
              p.name,
              p.timeIn ?? "—",
              p.budget.toFixed(2),
              String(p.ldCount ?? 0),
              ((p.ldCount ?? 0) * 100).toFixed(2),
              p.incentives.toFixed(2),
              otherInc(p).toFixed(2),
              p.adjustments.toFixed(2),
              p.deductions.toFixed(2),
              p.netPayout.toFixed(2),
              p.status,
            ]),
          });
          doc.save(`payroll_report_${fromTo}.pdf`);
        }
      }
      toast.success(`Exported as ${format}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to export as ${format}`);
    }
  }, [activeTab, dateFrom, dateTo, salesList, salesSummary, payroll, payrollSummary]);

  const handleComputePayouts = useCallback(async () => {
    setComputeModalOpen(true);
    setComputeProgress(0);
    setComputeStep("Initializing...");

    try {
      // Show progress steps while API computes
      const progressSteps = [
        { progress: 10, label: "Loading employee data..." },
        { progress: 30, label: "Calculating commissions..." },
        { progress: 50, label: "Processing incentives..." },
        { progress: 70, label: "Checking quotas..." },
      ];

      for (const step of progressSteps) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setComputeProgress(step.progress);
        setComputeStep(step.label);
      }

      // Call the API to compute payouts
      setComputeStep("Computing payouts...");
      const result = await api.reports.computePayouts(dateFrom, dateTo);
      
      setComputeProgress(90);
      setComputeStep("Finalizing...");
      await new Promise((resolve) => setTimeout(resolve, 300));

      setComputeProgress(100);
      setComputeStep("Complete!");

      await loadPayrollStable();

      await new Promise((resolve) => setTimeout(resolve, 800));
      setComputeModalOpen(false);
      
      if (result.computed > 0) {
        toast.success(`Computed payouts for ${result.computed} staff members`);
      } else {
        toast.info("No staff members found to compute payouts");
      }
    } catch {
      setComputeModalOpen(false);
      toast.error("Failed to compute payouts");
    }
  }, [dateFrom, dateTo, loadPayrollStable]);

  const handleApprove = useCallback(async (row: PayrollRow) => {
    try {
      await api.reports.approvePayout(row.id, user?.id);
      toast.success(`${row.name} payout approved`);
      loadPayrollStable();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve");
    }
  }, [user?.id, loadPayrollStable]);

  const handlePrintPayslip = useCallback((row: PayrollRow) => {
    const printWindow = window.open("", "_blank", "width=520,height=680");
    if (!printWindow) return;

    const dateTimeIn = `${dateFrom} to ${dateTo}`;
    const ldCount = row.ldCount ?? 0;
    const totalPayout = row.netPayout;
    const generatedAt = new Date().toLocaleString();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payslip - ${row.name}</title>
        <style>
          @page { size: auto; margin: 12mm; }
          * { box-sizing: border-box; }
          body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 13px; margin: 0; padding: 24px; color: #000; max-width: 400px; margin: 0 auto; }
          .receipt { border: 1px solid #000; }
          .header { padding: 16px 24px; text-align: center; border-bottom: 1px dashed #000; }
          .company { font-size: 18px; font-weight: 700; margin: 0 0 2px 0; color: #000; }
          .tagline { font-size: 11px; margin: 0; color: #000; }
          .doc-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 6px; color: #000; }
          .section { padding: 12px 24px; }
          .section-title { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; color: #000; }
          .divider { border: none; border-top: 1px dashed #000; margin: 10px 0; }
          .row { display: flex; justify-content: space-between; align-items: baseline; margin: 4px 0; gap: 16px; }
          .label { font-size: 12px; color: #000; }
          .value { font-weight: 500; text-align: right; color: #000; }
          .total-block { padding: 12px 24px; margin: 0 24px 12px; border: 1px solid #000; }
          .total-row { display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 700; color: #000; }
          .footer { padding: 12px 24px; text-align: center; font-size: 11px; color: #000; border-top: 1px dashed #000; }
          .footer-row { margin: 3px 0; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <p class="company">RABBIT ALLEY</p>
            <p class="tagline">Bar & Restaurant</p>
            <p class="doc-title">Payslip Receipt</p>
          </div>
          <div class="section">
            <div class="section-title">Employee</div>
            <div class="row"><span class="label">Name</span><span class="value">${row.name}</span></div>
            <div class="row"><span class="label">Employee No.</span><span class="value">${row.employeeId}</span></div>
            <div class="row"><span class="label">Date and time in</span><span class="value">${dateTimeIn}</span></div>
          </div>
          <hr class="divider" />
          <div class="section">
            <div class="section-title">Earnings</div>
            <div class="row"><span class="label">Budget</span><span class="value">${row.budget.toFixed(2)}</span></div>
            <div class="row"><span class="label">LD count</span><span class="value">${ldCount}</span></div>
            <div class="row"><span class="label">Commission</span><span class="value">${row.commission.toFixed(2)}</span></div>
            ${(row.incentivesBreakdown && row.incentivesBreakdown.length > 0)
              ? row.incentivesBreakdown.map((i: BreakdownItem) => `<div class="row"><span class="label">${i.title || "Incentive"}</span><span class="value">${i.amount.toFixed(2)}</span></div>`).join("")
              : (row.incentives > 0 ? `<div class="row"><span class="label">Incentives</span><span class="value">${row.incentives.toFixed(2)}</span></div>` : "")}
            ${(row.adjustmentsBreakdown && row.adjustmentsBreakdown.length > 0)
              ? row.adjustmentsBreakdown.map((a: BreakdownItem) => `<div class="row"><span class="label">${a.title || "Adjustment"}</span><span class="value">${a.amount.toFixed(2)}</span></div>`).join("")
              : (row.adjustments !== 0 ? `<div class="row"><span class="label">Adjustments</span><span class="value">${row.adjustments.toFixed(2)}</span></div>` : "")}
          </div>
          <hr class="divider" />
          <div class="section">
            <div class="section-title">Deductions</div>
            ${(row.deductionsBreakdown && row.deductionsBreakdown.length > 0)
              ? row.deductionsBreakdown.map((d: BreakdownItem) => `<div class="row"><span class="label">${d.title || "Deduction"}</span><span class="value">${d.amount.toFixed(2)}</span></div>`).join("")
              : (row.deductions > 0 ? `<div class="row"><span class="label">Deductions</span><span class="value">${row.deductions.toFixed(2)}</span></div>` : `<div class="row"><span class="label">—</span><span class="value">0.00</span></div>`)}
          </div>
          <div class="total-block">
            <div class="total-row"><span>Total payout</span><span>${totalPayout.toFixed(2)}</span></div>
          </div>
          <div class="footer">
            <div class="footer-row">Status: ${row.status.toUpperCase()}</div>
            ${row.approvedBy ? `<div class="footer-row">Approved by: ${row.approvedBy}</div>` : ""}
            <div class="footer-row">Generated: ${generatedAt}</div>
            <div class="footer-row" style="margin-top: 8px;">This is a computer-generated payslip. Please retain for your records.</div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  }, [dateFrom, dateTo]);

  const handleDownloadPayslipPdf = useCallback((row: PayrollRow) => {
    const dateTimeIn = `${dateFrom} to ${dateTo}`;
    const ldCount = row.ldCount ?? 0;
    const totalPayout = row.netPayout;
    const generatedAt = new Date().toLocaleString();

    const doc = new jsPDF({ format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const left = 20;
    const right = pageW - 20;
    const center = pageW / 2;

    const dottedLine = (y: number) => {
      for (let x = left; x < right; x += 3) doc.line(x, y, Math.min(x + 2, right), y);
    };

    let y = 18;
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("RABBIT ALLEY", center, y, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Bar & Restaurant", center, y + 8, { align: "center" });
    doc.setFontSize(9);
    doc.text("PAYSLIP RECEIPT", center, y + 16, { align: "center" });
    dottedLine(y + 24);
    y += 32;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("EMPLOYEE", left, y);
    doc.setFont("helvetica", "normal");
    y += 6;
    doc.setFontSize(10);
    doc.text("Name", left, y);
    doc.text(row.name, right, y, { align: "right" });
    y += 5;
    doc.text("Employee No.", left, y);
    doc.text(row.employeeId, right, y, { align: "right" });
    y += 5;
    doc.text("Date and time in", left, y);
    doc.text(dateTimeIn, right, y, { align: "right" });
    y += 10;
    dottedLine(y);
    y += 8;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("EARNINGS", left, y);
    doc.setFont("helvetica", "normal");
    y += 6;
    doc.setFontSize(10);
    doc.text("Budget", left, y);
    doc.text(row.budget.toFixed(2), right, y, { align: "right" });
    y += 5;
    doc.text("LD count", left, y);
    doc.text(String(ldCount), right, y, { align: "right" });
    y += 5;
    doc.text("Commission", left, y);
    doc.text(row.commission.toFixed(2), right, y, { align: "right" });
    y += 5;
    if (row.incentivesBreakdown && row.incentivesBreakdown.length > 0) {
      for (const i of row.incentivesBreakdown) {
        doc.text(i.title || "Incentive", left, y);
        doc.text(i.amount.toFixed(2), right, y, { align: "right" });
        y += 5;
      }
    } else if (row.incentives > 0) {
      doc.text("Incentives", left, y);
      doc.text(row.incentives.toFixed(2), right, y, { align: "right" });
      y += 5;
    }
    if (row.adjustmentsBreakdown && row.adjustmentsBreakdown.length > 0) {
      for (const a of row.adjustmentsBreakdown) {
        doc.text(a.title || "Adjustment", left, y);
        doc.text(a.amount.toFixed(2), right, y, { align: "right" });
        y += 5;
      }
    } else if (row.adjustments !== 0) {
      doc.text("Adjustments", left, y);
      doc.text(row.adjustments.toFixed(2), right, y, { align: "right" });
      y += 5;
    }
    y += 5;
    dottedLine(y);
    y += 8;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("DEDUCTIONS", left, y);
    doc.setFont("helvetica", "normal");
    y += 6;
    doc.setFontSize(10);
    if (row.deductionsBreakdown && row.deductionsBreakdown.length > 0) {
      for (const d of row.deductionsBreakdown) {
        doc.text(d.title || "Deduction", left, y);
        doc.text(d.amount.toFixed(2), right, y, { align: "right" });
        y += 5;
      }
    } else if (row.deductions > 0) {
      doc.text("Deductions", left, y);
      doc.text(row.deductions.toFixed(2), right, y, { align: "right" });
      y += 5;
    }
    y += 7;

    doc.setDrawColor(0, 0, 0);
    doc.rect(left, y - 2, right - left, 14, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Total payout", left + 4, y + 6);
    doc.text(totalPayout.toFixed(2), right - 4, y + 6, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 20;
    dottedLine(y);
    y += 10;

    doc.setFontSize(9);
    doc.text(`Status: ${row.status.toUpperCase()}`, center, y, { align: "center" });
    y += 5;
    if (row.approvedBy) {
      doc.text(`Approved by: ${row.approvedBy}`, center, y, { align: "center" });
      y += 5;
    }
    doc.text(`Generated: ${generatedAt}`, center, y, { align: "center" });
    y += 8;
    doc.setFontSize(8);
    doc.text("This is a computer-generated payslip. Please retain for your records.", center, y, { align: "center" });

    doc.save(`payslip_${row.employeeId}_${dateFrom}_${dateTo}.pdf`);
    toast.success("Payslip PDF downloaded");
  }, [dateFrom, dateTo]);

  const handlePrintPayslipThermal = useCallback(async (row: PayrollRow) => {
    const gross = row.budget + row.commission + row.incentives + row.adjustments;
    const net = gross - row.deductions;
    try {
      const res = await api.print.payslip({
        employeeId: row.employeeId,
        name: row.name,
        periodFrom: dateFrom,
        periodTo: dateTo,
        allowance: row.budget,
        hours: 0,
        perHour: 0,
        commission: row.commission,
        incentives: row.incentives,
        adjustments: row.adjustments,
        deductions: row.deductions,
        gross,
        netPayout: net,
        status: row.status,
        approvedBy: row.approvedBy ?? undefined,
      });
      if (res.ok) toast.success("Payslip sent to thermal printer");
      else toast.warning(res.fallback ? "Printer unavailable; use Print or Download PDF" : res.error ?? "Print failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to print payslip");
    }
  }, [dateFrom, dateTo]);

  const handleUpdateBreakdown = useCallback(async (row: PayrollRow, field: "incentives" | "adjustments" | "deductions", breakdown: BreakdownItem[]) => {
    const total = breakdown.reduce((s, x) => s + x.amount, 0);
    const payload = { [`${field}Breakdown`]: breakdown } as const;
    try {
      await api.reports.updatePayout(row.id, payload);
      setPayroll((prev) =>
        prev.map((r) => {
          if (r.id !== row.id) return r;
          const next = { ...r, [`${field}Breakdown`]: breakdown };
          if (field === "adjustments") next.adjustments = total;
          if (field === "deductions") next.deductions = total;
          const otherInc = Array.isArray(next.incentivesBreakdown) ? next.incentivesBreakdown.reduce((s, x) => s + x.amount, 0) : 0;
          next.netPayout = next.budget + next.commission + next.incentives + otherInc + next.adjustments - next.deductions;
          return next;
        })
      );
      toast.success("Updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
      loadPayrollStable();
    }
  }, [loadPayrollStable]);

  return (
    <AppLayout>
      <PageHeader title="Reports" description="View sales and payroll reports">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("PDF")}>
            <File className="w-4 h-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("Excel")}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("CSV")}>
            <FileText className="w-4 h-4 mr-2" />
            CSV
          </Button>
        </div>
      </PageHeader>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === "sales" ? "default" : "secondary"}
          onClick={() => setActiveTab("sales")}
        >
          Sales Report
        </Button>
        <Button
          variant={activeTab === "payroll" ? "default" : "secondary"}
          onClick={() => setActiveTab("payroll")}
        >
          Payroll Report
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">From:</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">To:</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-auto"
          />
        </div>
        <Button variant="secondary" onClick={handleFilter}>
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
        {activeTab === "payroll" && (
          <Button onClick={handleComputePayouts}>
            <Calculator className="w-4 h-4 mr-2" />
            Compute Payouts
          </Button>
        )}
      </div>

      {activeTab === "sales" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total Orders"
              value={salesSummary.totalOrders}
              icon={<ShoppingBag className="w-5 h-5" />}
            />
            <StatCard
              label="Total Sales"
              value={formatCurrency(salesSummary.totalSales)}
              icon={<DollarSign className="w-5 h-5" />}
            />
            <StatCard
              label="Discounts"
              value={formatCurrency(salesSummary.totalDiscounts)}
              icon={<Percent className="w-5 h-5" />}
            />
            <StatCard
              label="Tax Collected"
              value={formatCurrency(salesSummary.totalTax)}
              icon={<Receipt className="w-5 h-5" />}
            />
          </div>

          <div className="rounded-lg border border-border overflow-hidden max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/95 z-10">
                <TableRow>
                  <TableHead>Order No</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingSales ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : (
                  salesList.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-muted/60 transition-colors"
                      onClick={() => handleViewOrder(order.id)}
                    >
                      <TableCell className="font-mono text-xs">{order.id}</TableCell>
                      <TableCell>{order.area}</TableCell>
                      <TableCell>{order.table}</TableCell>
                      <TableCell className="text-muted-foreground">{order.employee}</TableCell>
                      <TableCell className="text-right">{formatCurrency(order.subtotal)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCurrency(order.discount)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCurrency(order.tax)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(order.total)}</TableCell>
                      <TableCell>
                        <Badge className={cn(
                          order.status === "paid"
                            ? "bg-success/20 text-success border-success/30"
                            : "bg-warning/20 text-warning border-warning/30"
                        )}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{order.time}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {activeTab === "payroll" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <StatCard
              label="Total Employees"
              value={payrollSummary.totalEmployees}
              icon={<Users className="w-5 h-5" />}
            />
            <StatCard
              label="Total Payout"
              value={formatCurrency(payrollSummary.totalPayout)}
              icon={<DollarSign className="w-5 h-5" />}
            />
            <StatCard
              label="Total LD"
              value={payrollSummary.totalLd}
              icon={<ShoppingBag className="w-5 h-5" />}
            />
            <StatCard
              label="Total Incentives"
              value={formatCurrency(payrollSummary.totalIncentives)}
              icon={<CheckCircle className="w-5 h-5" />}
            />
            <StatCard
              label="Total Deductions"
              value={formatCurrency(payrollSummary.totalDeductions)}
              icon={<Percent className="w-5 h-5" />}
            />
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
          <Table wrapperClassName="max-h-[500px] overflow-y-auto overflow-x-auto">
            <TableHeader>
              <TableRow className="border-b [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-muted [&>th]:shadow-[0_1px_0_0_hsl(var(--border))]">
                <TableHead className="whitespace-nowrap">Employee</TableHead>
                <TableHead className="whitespace-nowrap">Employee ID</TableHead>
                <TableHead className="whitespace-nowrap">Time In</TableHead>
                <TableHead className="text-right whitespace-nowrap">Budget</TableHead>
                <TableHead className="text-center whitespace-nowrap">Total LD</TableHead>
                <TableHead className="text-right whitespace-nowrap">Total LD Commission</TableHead>
                <TableHead className="text-right whitespace-nowrap">Incentives</TableHead>
                <TableHead className="text-right whitespace-nowrap">Other Incentives</TableHead>
                <TableHead className="text-right whitespace-nowrap">Adjustments</TableHead>
                <TableHead className="text-right whitespace-nowrap">Deductions</TableHead>
                <TableHead className="text-right whitespace-nowrap font-semibold">Net Payout</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="whitespace-nowrap">Actions</TableHead>
                <TableHead className="whitespace-nowrap">Apprvd By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingPayroll ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : (
                payroll.map((row) => (
                  <PayrollTableRow
                    key={row.id}
                    row={row}
                    onUpdateBreakdown={handleUpdateBreakdown}
                    onApprove={handleApprove}
                    onPrintPayslip={handlePrintPayslip}
                    onDownloadPayslipPdf={handleDownloadPayslipPdf}
                    onPrintPayslipThermal={handlePrintPayslipThermal}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
        </>
      )}

      {/* Order Detail Modal */}
      <Dialog open={!!orderDetail || orderDetailLoading} onOpenChange={(open) => { if (!open) setOrderDetail(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Order History
              {orderDetail && (
                <span className="text-muted-foreground font-normal text-sm ml-1">
                  #{orderDetail.id}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {orderDetailLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Loading order details…
            </div>
          ) : orderDetail ? (
            <div className="flex flex-col gap-4 overflow-y-auto">
              {/* Order meta */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>{orderDetail.area} — {orderDetail.table}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="w-4 h-4 shrink-0" />
                  <span>{orderDetail.employee || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>{new Date(orderDetail.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CreditCard className="w-4 h-4 shrink-0" />
                  <span className="capitalize">{orderDetail.paymentMethod || "—"}</span>
                </div>
              </div>

              <Separator />

              {/* Items list */}
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60">
                      <TableHead>Item</TableHead>
                      <TableHead className="text-center w-16">Qty</TableHead>
                      <TableHead className="text-right w-24">Unit Price</TableHead>
                      <TableHead className="text-right w-24">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderDetail.items.map((item) => (
                      <TableRow
                        key={item.id}
                        className={cn(item.isVoided && "opacity-50")}
                      >
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className={cn("font-medium text-sm", item.isVoided && "line-through text-muted-foreground")}>
                              {item.name}
                              {item.isComplimentary && (
                                <span className="ml-1.5 text-xs text-purple-600 font-normal">(Complimentary)</span>
                              )}
                              {item.isVoided && (
                                <span className="ml-1.5 text-xs text-destructive font-normal">VOIDED</span>
                              )}
                            </span>
                            {item.servedByName && (
                              <span className="text-xs text-violet-600">Lady: {item.servedByName}</span>
                            )}
                            {item.specialRequest && (
                              <span className="text-xs text-amber-600 italic">"{item.specialRequest}"</span>
                            )}
                            {item.discount > 0 && (
                              <span className="text-xs text-green-600">Discount: -{formatCurrency(item.discount)}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center tabular-nums">{item.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className={cn("text-right tabular-nums font-medium", item.isVoided && "line-through text-muted-foreground")}>
                          {formatCurrency(item.subtotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="rounded-lg border p-4 space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(orderDetail.subtotal)}</span>
                </div>
                {orderDetail.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(orderDetail.discount)}</span>
                  </div>
                )}
                {orderDetail.tax > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax</span>
                    <span>{formatCurrency(orderDetail.tax)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>{formatCurrency(orderDetail.total)}</span>
                </div>
              </div>

              {/* Status badge */}
              <div className="flex justify-end">
                <Badge className={cn(
                  orderDetail.status === "paid"
                    ? "bg-success/20 text-success border-success/30"
                    : orderDetail.status === "voided"
                      ? "bg-destructive/20 text-destructive border-destructive/30"
                      : "bg-warning/20 text-warning border-warning/30"
                )}>
                  {orderDetail.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Compute Payout Modal */}
      <Dialog open={computeModalOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-md [&>button]:hidden">
          <div className="flex flex-col items-center py-4">
            {computeProgress < 100 ? (
              <>
                <div className="w-16 h-16 mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calculator className="w-8 h-8 text-primary animate-pulse" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Computing Payouts</h3>
                <p className="text-sm text-muted-foreground mb-6">{computeStep}</p>
                <div className="w-full space-y-2">
                  <Progress value={computeProgress} className="h-3" />
                  <p className="text-xs text-muted-foreground text-center">{computeProgress}%</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 mb-6 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-green-600 mb-2">Computation Complete!</h3>
                <p className="text-sm text-muted-foreground">All payouts have been calculated.</p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
