import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { getDefaultHomePath } from "@/lib/authRoutes";
import {
  STORAGE_PERMISSIONS,
  PRINT_JOB_TYPES,
  PRINT_JOB_LABELS,
  PRINT_JOB_HELPER,
  PRINT_JOB_ASSIGNMENTS_SETTING_KEY,
  type PrintJobType,
  type PrinterAssignments,
  parsePrinterAssignments,
  savePrinterAssignmentsLocal,
  applyPrinterAssignmentsFromSetting,
  autoAssignPrinters,
  emptyPrinterAssignments,
} from "@/lib/storage-keys";
import { getPosSettings, savePosSettings } from "@/lib/posSettings";
import { isQzTrayEnabled, setQzTrayEnabled, qzListPrinters } from "@/lib/qzTray";

type PrinterOption = { name: string; isDefault?: boolean; displayName?: string; isNetwork?: boolean };

/** Grid order matches the reference layout (left column then right column, row-wise). */
const PRINT_JOB_GRID: PrintJobType[] = [
  "payment_receipt",
  "running_bill",
  "order_slip",
  "bar_chit",
  "kitchen_chit",
  "ld_chit",
];

function PrinterSelect({
  label,
  value,
  printers,
  onChange,
}: {
  label: string;
  value: string;
  printers: PrinterOption[];
  onChange: (name: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value || "_none"} onValueChange={(v) => onChange(v === "_none" ? "" : v)}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="None" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_none">None</SelectItem>
          {printers.map((p) => (
            <SelectItem key={p.name} value={p.name}>
              {p.displayName || p.name}
              {p.isDefault ? " (default)" : ""}
              {p.isNetwork ? " — network" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function Settings() {
  const { hasPermission, user } = useAuth();
  const canManage = hasPermission("manage_settings");

  const local = getPosSettings();
  const [businessName, setBusinessName] = useState(local.businessName);
  const [address, setAddress] = useState(local.address);
  const [contact, setContact] = useState(local.contact);
  const [vatTin, setVatTin] = useState(local.vatTin);
  const [receiptFooter, setReceiptFooter] = useState(local.receiptFooter);
  const [taxRate, setTaxRate] = useState(String(local.taxRate));
  const [serviceChargeMode, setServiceChargeMode] = useState<"percent" | "fixed">(local.serviceChargeMode);
  const [serviceChargeValue, setServiceChargeValue] = useState(String(local.serviceChargeValue));
  const [cardSurcharge, setCardSurcharge] = useState(String(local.cardSurcharge));
  const [isSaving, setIsSaving] = useState(false);
  const [printers, setPrinters] = useState<PrinterOption[]>([]);
  const [printersError, setPrintersError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<PrinterAssignments>(() => parsePrinterAssignments());
  const [qzTrayOn, setQzTrayOn] = useState(() => isQzTrayEnabled());
  const [qzPrinters, setQzPrinters] = useState<string[]>([]);
  const [qzLoading, setQzLoading] = useState(false);

  const [lanName, setLanName] = useState("");
  const [lanIp, setLanIp] = useState("");
  const [lanPort, setLanPort] = useState("9100");
  const [lanSaving, setLanSaving] = useState(false);

  const persistAssignments = useCallback(async (next: PrinterAssignments, successMessage?: string) => {
    const normalized = { ...emptyPrinterAssignments(), ...next };
    for (const key of PRINT_JOB_TYPES) {
      normalized[key] = (normalized[key] || "").trim();
    }
    setAssignments(normalized);
    savePrinterAssignmentsLocal(normalized);
    try {
      await api.settings.save({
        [PRINT_JOB_ASSIGNMENTS_SETTING_KEY]: JSON.stringify(normalized),
      });
      if (successMessage) toast.success(successMessage);
    } catch {
      toast.warning("Printer assignments saved on this PC only — could not sync with server.");
    }
  }, []);

  const loadPrinters = useCallback(() => {
    api.print
      .printers()
      .then((res) => {
        setPrinters((res.printers || []) as PrinterOption[]);
        setPrintersError(res.error || null);
      })
      .catch(() => {
        setPrinters([]);
        setPrintersError("Could not load printers");
      });
  }, []);

  useEffect(() => {
    if (!canManage) return;
    api.settings
      .get()
      .then((dbSettings) => {
        const merged = {
          businessName: dbSettings.business_name ?? local.businessName,
          address: dbSettings.business_address ?? local.address,
          contact: dbSettings.business_contact ?? local.contact,
          vatTin: dbSettings.vat_tin ?? local.vatTin,
          receiptFooter: dbSettings.receipt_footer ?? local.receiptFooter,
          taxRate: dbSettings.tax_rate != null ? Number(dbSettings.tax_rate) : local.taxRate,
          serviceChargeMode: (dbSettings.service_charge_mode === "fixed" ? "fixed" : "percent") as "percent" | "fixed",
          serviceChargeValue:
            dbSettings.service_charge_value != null ? Number(dbSettings.service_charge_value) : local.serviceChargeValue,
          cardSurcharge: dbSettings.card_surcharge != null ? Number(dbSettings.card_surcharge) : local.cardSurcharge,
        };
        savePosSettings(merged);
        setBusinessName(merged.businessName);
        setAddress(merged.address);
        setContact(merged.contact);
        setVatTin(merged.vatTin);
        setReceiptFooter(merged.receiptFooter);
        setTaxRate(String(merged.taxRate));
        setServiceChargeMode(merged.serviceChargeMode);
        setServiceChargeValue(String(merged.serviceChargeValue));
        setCardSurcharge(String(merged.cardSurcharge));

        const remoteRaw = dbSettings[PRINT_JOB_ASSIGNMENTS_SETTING_KEY];
        if (remoteRaw) {
          const remote = applyPrinterAssignmentsFromSetting(remoteRaw);
          setAssignments(remote);
        } else {
          // Push migrated/local assignments to DB once so other terminals can use them
          const localAssignments = parsePrinterAssignments();
          const hasAny = PRINT_JOB_TYPES.some((t) => localAssignments[t]?.trim());
          if (hasAny) {
            setAssignments(localAssignments);
            api.settings
              .save({ [PRINT_JOB_ASSIGNMENTS_SETTING_KEY]: JSON.stringify(localAssignments) })
              .catch(() => {});
          }
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  useEffect(() => {
    if (!canManage) return;
    loadPrinters();
  }, [canManage, loadPrinters]);

  if (!canManage) {
    let permissions: string[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_PERMISSIONS);
      permissions = raw ? JSON.parse(raw) : [];
    } catch {
      permissions = [];
    }
    return <Navigate to={getDefaultHomePath(user?.role, permissions)} replace />;
  }

  const handleSave = async () => {
    const tax = parseFloat(taxRate);
    const serviceVal = parseFloat(serviceChargeValue);
    const surcharge = parseFloat(cardSurcharge);
    if (isNaN(tax) || tax < 0 || tax > 100) {
      toast.error("Tax rate must be between 0 and 100");
      return;
    }
    if (isNaN(serviceVal) || serviceVal < 0) {
      toast.error("Service charge value must be a positive number");
      return;
    }
    if (isNaN(surcharge) || surcharge < 0 || surcharge > 100) {
      toast.error("Card surcharge must be between 0 and 100");
      return;
    }
    setIsSaving(true);
    const newSettings = {
      businessName: businessName.trim(),
      address: address.trim(),
      contact: contact.trim(),
      vatTin: vatTin.trim(),
      receiptFooter: receiptFooter.trim(),
      taxRate: tax,
      serviceChargeMode,
      serviceChargeValue: serviceVal,
      cardSurcharge: surcharge,
    };
    savePosSettings(newSettings);
    try {
      await api.settings.save({
        business_name: newSettings.businessName,
        business_address: newSettings.address,
        business_contact: newSettings.contact,
        vat_tin: newSettings.vatTin,
        receipt_footer: newSettings.receiptFooter,
        tax_rate: String(newSettings.taxRate),
        service_charge_mode: newSettings.serviceChargeMode,
        service_charge_value: String(newSettings.serviceChargeValue),
        card_surcharge: String(newSettings.cardSurcharge),
        [PRINT_JOB_ASSIGNMENTS_SETTING_KEY]: JSON.stringify(assignments),
      });
    } catch {
      toast.warning("Settings saved locally — could not sync with server.");
      setIsSaving(false);
      return;
    }
    setIsSaving(false);
    toast.success("Settings saved successfully!");
  };

  const setAssignment = (type: PrintJobType, name: string) => {
    const next = { ...assignments, [type]: name };
    void persistAssignments(next, name ? `${PRINT_JOB_LABELS[type]} → ${name}` : `${PRINT_JOB_LABELS[type]} disabled`);
  };

  const handleAutoAssign = () => {
    if (printers.length === 0) {
      toast.error("No printers available to assign");
      return;
    }
    const next = autoAssignPrinters(assignments, printers);
    const filled = PRINT_JOB_TYPES.filter((t) => !assignments[t]?.trim() && next[t]?.trim()).length;
    if (filled === 0) {
      toast.info("All print types already have a printer assigned");
      return;
    }
    void persistAssignments(next, `Auto-assigned ${filled} print type${filled === 1 ? "" : "s"}`);
  };

  const handleAddLanPrinter = async () => {
    const name = lanName.trim();
    const ip = lanIp.trim();
    const port = lanPort.trim() || "9100";
    if (!name) {
      toast.error("Printer name is required");
      return;
    }
    if (!ip) {
      toast.error("IP address is required");
      return;
    }
    if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
      toast.error("Port must be between 1 and 65535");
      return;
    }
    setLanSaving(true);
    try {
      const iface = `tcp://${ip}:${port}`;
      const res = await api.print.addPrinter({ name, interface: iface, type: "epson" });
      if (!res.ok) {
        toast.error(res.error || "Failed to add printer");
        return;
      }
      toast.success(`Added ${name} (${iface})`);
      setLanName("");
      setLanIp("");
      setLanPort("9100");
      loadPrinters();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add printer");
    } finally {
      setLanSaving(false);
    }
  };

  const networkPrinters = printers.filter((p) => p.isNetwork || p.name.startsWith("tcp://"));

  return (
    <AppLayout>
      <div className="flex flex-col gap-3 max-w-[1600px]">
        <div className="flex shrink-0 items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">Business, printing, and tax rates</p>
          </div>
          <Button onClick={handleSave} disabled={isSaving} size="sm">
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3 xl:items-start">
          {/* Column 1 — Business */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base">Business Information</CardTitle>
              <CardDescription className="text-xs">Shown on receipts and reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 pt-0">
              <div className="space-y-1">
                <Label htmlFor="businessName" className="text-xs">
                  Business Name
                </Label>
                <Input
                  id="businessName"
                  className="h-9"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="address" className="text-xs">
                  Address
                </Label>
                <Textarea
                  id="address"
                  className="min-h-[52px] resize-none text-sm"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="contact" className="text-xs">
                    Contact
                  </Label>
                  <Input id="contact" className="h-9" value={contact} onChange={(e) => setContact(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="vatTin" className="text-xs">
                    TIN
                  </Label>
                  <Input id="vatTin" className="h-9" value={vatTin} onChange={(e) => setVatTin(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="receiptFooter" className="text-xs">
                  Receipt footer
                </Label>
                <Textarea
                  id="receiptFooter"
                  className="min-h-[44px] resize-none text-sm"
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  rows={2}
                  placeholder="Bottom of printed receipts"
                />
              </div>
            </CardContent>
          </Card>

          {/* Column 2 — Printers (by print job type) */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base">Printers</CardTitle>
              <CardDescription className="text-xs space-y-0.5">
                <span className="block">Assign any printer to each print type — no fixed area rules</span>
                <span className="block">
                  Pick which printer handles each job. Running bill, payment receipt, bar chit, etc. can all go to
                  different printers.
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 pt-0">
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={handleAutoAssign}>
                Auto-assign
              </Button>

              <div className="grid grid-cols-2 gap-3">
                {PRINT_JOB_GRID.map((type) => (
                  <PrinterSelect
                    key={type}
                    label={PRINT_JOB_LABELS[type]}
                    value={assignments[type] ?? ""}
                    printers={printers}
                    onChange={(name) => setAssignment(type, name)}
                  />
                ))}
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">{PRINT_JOB_HELPER}</p>

              {(printersError || printers.length === 0) && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {printersError || "Loading printers…"}
                </p>
              )}

              <details className="text-xs text-muted-foreground group">
                <summary className="cursor-pointer hover:text-foreground list-none flex items-center gap-1">
                  <span className="inline-block transition-transform group-open:rotate-90">▶</span>
                  LAN printer setup (.env)
                </summary>
                <div className="mt-2 pl-2 border-l-2 border-muted space-y-3">
                  <p>
                    Static list: set{" "}
                    <code className="bg-muted px-1 rounded">PRINTER_INTERFACE=tcp://IP:9100</code> in{" "}
                    <code className="bg-muted px-1 rounded">server/.env</code> (comma-separated for multiple), then
                    restart the server. Or add printers below — they are stored in the database and appear in the
                    dropdowns above.
                  </p>

                  {networkPrinters.length > 0 && (
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">Configured LAN printers</p>
                      <ul className="space-y-0.5">
                        {networkPrinters.map((p) => (
                          <li key={p.name} className="font-mono text-[11px]">
                            {p.displayName || p.name}
                            {p.displayName && p.displayName !== p.name ? (
                              <span className="text-muted-foreground"> · {p.name}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="space-y-1 sm:col-span-1">
                      <Label htmlFor="lanName" className="text-xs">
                        Printer name
                      </Label>
                      <Input
                        id="lanName"
                        className="h-8 text-sm"
                        placeholder="Kitchen"
                        value={lanName}
                        onChange={(e) => setLanName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="lanIp" className="text-xs">
                        IP address
                      </Label>
                      <Input
                        id="lanIp"
                        className="h-8 text-sm font-mono"
                        placeholder="192.168.1.100"
                        value={lanIp}
                        onChange={(e) => setLanIp(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="lanPort" className="text-xs">
                        Port
                      </Label>
                      <Input
                        id="lanPort"
                        className="h-8 text-sm font-mono"
                        placeholder="9100"
                        value={lanPort}
                        onChange={(e) => setLanPort(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={lanSaving}
                    onClick={() => void handleAddLanPrinter()}
                  >
                    {lanSaving ? "Adding…" : "Add LAN printer"}
                  </Button>
                </div>
              </details>
            </CardContent>
          </Card>

          {/* Column 3 — QZ + Tax */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base">Tax &amp; Printing</CardTitle>
              <CardDescription className="text-xs">Rates and optional QZ Tray on this PC</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 pt-0">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="taxRate" className="text-xs">
                    Tax (%)
                  </Label>
                  <Input
                    id="taxRate"
                    className="h-9"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="serviceChargeValue" className="text-xs">
                    Service {serviceChargeMode === "percent" ? "(%)" : "(₱)"}
                  </Label>
                  <div className="flex gap-1">
                    <Select
                      value={serviceChargeMode}
                      onValueChange={(v: "percent" | "fixed") => setServiceChargeMode(v)}
                    >
                      <SelectTrigger id="serviceChargeMode" className="h-9 w-[5.5rem] shrink-0 text-xs px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="fixed">₱</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      id="serviceChargeValue"
                      className="h-9 min-w-0 flex-1"
                      type="number"
                      min={0}
                      step={serviceChargeMode === "percent" ? 0.5 : 1}
                      value={serviceChargeValue}
                      onChange={(e) => setServiceChargeValue(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cardSurcharge" className="text-xs">
                    Card fee (%)
                  </Label>
                  <Input
                    id="cardSurcharge"
                    className="h-9"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={cardSurcharge}
                    onChange={(e) => setCardSurcharge(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs grid grid-cols-3 gap-2">
                <div>
                  <span className="text-muted-foreground">Tax </span>
                  <span className="font-medium">{taxRate}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Service </span>
                  <span className="font-medium">
                    {serviceChargeMode === "percent" ? `${serviceChargeValue}%` : `₱${serviceChargeValue}`}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Card </span>
                  <span className="font-medium">{cardSurcharge}%</span>
                </div>
              </div>

              <div className="border-t pt-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">QZ Tray</p>
                    <p className="text-xs text-muted-foreground">USB / Windows printers on this PC</p>
                  </div>
                  <Switch
                    checked={qzTrayOn}
                    onCheckedChange={(on) => {
                      setQzTrayOn(on);
                      setQzTrayEnabled(on);
                      toast.success(on ? "QZ Tray on" : "Server LAN printing");
                    }}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={qzLoading}
                    onClick={async () => {
                      setQzLoading(true);
                      try {
                        const list = await qzListPrinters();
                        setQzPrinters(list);
                        toast.success(`QZ: ${list.length} printer(s)`);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Start QZ Tray and allow this site.");
                      } finally {
                        setQzLoading(false);
                      }
                    }}
                  >
                    {qzLoading ? "Connecting…" : "Load QZ printers"}
                  </Button>
                  <a
                    href="https://qz.io/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline"
                  >
                    Download QZ
                  </a>
                </div>
                {qzPrinters.length > 0 && (
                  <p className="text-xs text-muted-foreground truncate" title={qzPrinters.join(", ")}>
                    {qzPrinters.join(" · ")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
