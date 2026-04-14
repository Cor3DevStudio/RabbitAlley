import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
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
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  POS_AREAS,
  POS_DEPTS,
  RECEIPT_PRINTERS_BY_AREA_KEY,
  RECEIPT_PRINTER_STORAGE_KEY,
  DEPT_PRINTERS_KEY,
  type ReceiptPrintersByArea,
  type DeptPrinters,
} from "@/lib/storage-keys";
import { getPosSettings, savePosSettings } from "@/lib/posSettings";
import { isQzTrayEnabled, setQzTrayEnabled, qzListPrinters } from "@/lib/qzTray";

export default function Settings() {
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
  const [printers, setPrinters] = useState<Array<{ name: string; isDefault?: boolean }>>([]);
  const [printersError, setPrintersError] = useState<string | null>(null);
  const [receiptPrintersByArea, setReceiptPrintersByArea] = useState<ReceiptPrintersByArea>(() => {
    try {
      const raw = localStorage.getItem(RECEIPT_PRINTERS_BY_AREA_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Record<string, string>;
        return { Lounge: p.Lounge ?? "", Club: p.Club ?? "", LD: p.LD ?? "" };
      }
      const single = localStorage.getItem(RECEIPT_PRINTER_STORAGE_KEY) || "";
      return { Lounge: single, Club: single, LD: single };
    } catch {
      return { Lounge: "", Club: "", LD: "" };
    }
  });
  const [qzTrayOn, setQzTrayOn] = useState(() => isQzTrayEnabled());
  const [qzPrinters, setQzPrinters] = useState<string[]>([]);
  const [qzLoading, setQzLoading] = useState(false);

  const [deptPrinters, setDeptPrinters] = useState<DeptPrinters>(() => {
    try {
      const raw = localStorage.getItem(DEPT_PRINTERS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Record<string, string>;
        return { Bar: p.Bar ?? "", Kitchen: p.Kitchen ?? "", LD: p.LD ?? "" };
      }
      return { Bar: "", Kitchen: "", LD: "" };
    } catch {
      return { Bar: "", Kitchen: "", LD: "" };
    }
  });

  // Fetch settings from DB on mount and merge into local state (DB is source of truth)
  useEffect(() => {
    api.settings.get().then((dbSettings) => {
      const merged = {
        businessName: dbSettings.business_name ?? local.businessName,
        address: dbSettings.business_address ?? local.address,
        contact: dbSettings.business_contact ?? local.contact,
        vatTin: dbSettings.vat_tin ?? local.vatTin,
        receiptFooter: dbSettings.receipt_footer ?? local.receiptFooter,
        taxRate: dbSettings.tax_rate != null ? Number(dbSettings.tax_rate) : local.taxRate,
        serviceChargeMode: (dbSettings.service_charge_mode === "fixed" ? "fixed" : "percent") as "percent" | "fixed",
        serviceChargeValue: dbSettings.service_charge_value != null ? Number(dbSettings.service_charge_value) : local.serviceChargeValue,
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
    }).catch(() => {
      // DB unavailable — keep local values
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.print
      .printers()
      .then((res) => {
        setPrinters(res.printers || []);
        setPrintersError(res.error || null);
        const raw = localStorage.getItem(RECEIPT_PRINTERS_BY_AREA_KEY);
        if (raw) {
          try {
            const p = JSON.parse(raw) as Record<string, string>;
            setReceiptPrintersByArea({ Lounge: p.Lounge ?? "", Club: p.Club ?? "", LD: p.LD ?? "" });
          } catch {
            // keep current state
          }
        }
      })
      .catch(() => {
        setPrinters([]);
        setPrintersError("Could not load printers");
      });
  }, []);

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
      businessName: businessName.trim() || "Rabbit Alley",
      address: address.trim(),
      contact: contact.trim(),
      vatTin: vatTin.trim(),
      receiptFooter: receiptFooter.trim(),
      taxRate: tax,
      serviceChargeMode,
      serviceChargeValue: serviceVal,
      cardSurcharge: surcharge,
    };
    // Save to localStorage (fast reads by POS) and DB (shared across devices)
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
      });
    } catch {
      toast.warning("Settings saved locally — could not sync with server.");
      setIsSaving(false);
      return;
    }
    setIsSaving(false);
    toast.success("Settings saved successfully!");
  };

  return (
    <AppLayout>
      <PageHeader title="Settings" description="Configure business and system settings">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
        {/* Left panel: Business & Receipt */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>Your business details for receipts and reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Business name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  placeholder="Full address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact">Contact Number</Label>
                <Input
                  id="contact"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="+63 912 345 6789"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vatTin">TIN Number</Label>
                <Input
                  id="vatTin"
                  value={vatTin}
                  onChange={(e) => setVatTin(e.target.value)}
                  placeholder="123-456-789-000"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Receipt Settings</CardTitle>
              <CardDescription>Customize your printed receipts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <Label>Receipt printers by area (automatic print)</Label>
                <p className="text-xs text-muted-foreground">
                  Set one printer per area. Receipts for Lounge tables print to the Lounge printer, Club to Club, LD to LD.
                </p>
                {POS_AREAS.map((area) => (
                  <div key={area} className="space-y-1">
                    <Label className="text-muted-foreground">{area}</Label>
                    <Select
                      value={(receiptPrintersByArea[area] ?? "") || "_none"}
                      onValueChange={(v) => {
                        const name = v === "_none" ? "" : v;
                        const next = { ...receiptPrintersByArea, [area]: name };
                        setReceiptPrintersByArea(next);
                        localStorage.setItem(RECEIPT_PRINTERS_BY_AREA_KEY, JSON.stringify(next));
                        toast.success(name ? `${area} receipts → ${name}` : `${area} printer cleared`);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={`Select printer for ${area}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">No automatic print</SelectItem>
                        {printers.map((p) => (
                          <SelectItem key={p.name} value={p.name}>
                            {(p as { displayName?: string }).displayName || p.name}
                            {p.isDefault ? " (default)" : ""}
                            {(p as { isNetwork?: boolean }).isNetwork ? " — network" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {printersError && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">{printersError}</p>
                )}
                {printers.length === 0 && !printersError && (
                  <p className="text-xs text-muted-foreground">Loading printers…</p>
                )}
                <p className="text-xs text-muted-foreground">
                  <strong>LAN printers:</strong> in <code className="bg-muted px-1 rounded">server/.env</code> set <code className="bg-muted px-1 rounded">PRINTER_INTERFACE=tcp://IP:9100</code> (e.g. <code className="bg-muted px-1 rounded">tcp://192.168.1.101:9100,tcp://192.168.1.102:9100,tcp://192.168.1.103:9100</code> for 3 areas), restart the server, then assign each here to Lounge / Club / LD.
                </p>
              </div>
              <div className="space-y-4 border-t border-border pt-4">
                <Label>Department chit printers (Kitchen / Bar / LD)</Label>
                <p className="text-xs text-muted-foreground">
                  Set the LAN printer for each department. Order chits will print directly — no browser dialog.
                </p>
                {POS_DEPTS.map((dept) => (
                  <div key={dept} className="space-y-1">
                    <Label className="text-muted-foreground">{dept}</Label>
                    <Select
                      value={(deptPrinters[dept] ?? "") || "_none"}
                      onValueChange={(v) => {
                        const name = v === "_none" ? "" : v;
                        const next = { ...deptPrinters, [dept]: name };
                        setDeptPrinters(next);
                        localStorage.setItem(DEPT_PRINTERS_KEY, JSON.stringify(next));
                        toast.success(name ? `${dept} chits → ${name}` : `${dept} printer cleared`);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={`Select printer for ${dept}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">No direct print (use browser popup)</SelectItem>
                        {printers.map((p) => (
                          <SelectItem key={p.name} value={p.name}>
                            {(p as { displayName?: string }).displayName || p.name}
                            {p.isDefault ? " (default)" : ""}
                            {(p as { isNetwork?: boolean }).isNetwork ? " — network" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="receiptFooter">Receipt Footer Note</Label>
                <Textarea
                  id="receiptFooter"
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  placeholder="Message to print at the bottom of receipts"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right panel: QZ Tray, Tax & Charges */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>QZ Tray printing</CardTitle>
              <CardDescription>
                Print via{" "}
                <a href="https://qz.io/download/" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  QZ Tray
                </a>{" "}
                on this PC (USB / Windows printers). Server LAN printing stays available when this is off.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Use QZ Tray</p>
                  <p className="text-xs text-muted-foreground">
                    Printer names below must match QZ exactly (use Load printers).
                  </p>
                </div>
                <Switch
                  checked={qzTrayOn}
                  onCheckedChange={(on) => {
                    setQzTrayOn(on);
                    setQzTrayEnabled(on);
                    toast.success(on ? "QZ Tray mode on" : "LAN / server printing");
                  }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
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
                {qzLoading ? "Connecting…" : "Load printers from QZ Tray"}
              </Button>
              {qzPrinters.length > 0 && (
                <p className="text-xs text-muted-foreground break-all">
                  {qzPrinters.slice(0, 6).join(" · ")}
                  {qzPrinters.length > 6 ? ` … +${qzPrinters.length - 6}` : ""}
                </p>
              )}
              <p className="text-xs text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded-md p-2">
                Allow your POS URL in QZ Tray (e.g. <code className="bg-muted px-1">localhost:5173</code>). Production:{" "}
                <a href="https://qz.io/docs/signing" className="underline" target="_blank" rel="noopener noreferrer">
                  certificate signing
                </a>
                .
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tax & Service Charge</CardTitle>
              <CardDescription>Configure tax rates and service charges</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  placeholder="12"
                />
                <p className="text-xs text-muted-foreground">Applied to subtotal (e.g. 12% VAT)</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="serviceChargeMode">Service Charge Mode</Label>
                  <Select value={serviceChargeMode} onValueChange={(v: "percent" | "fixed") => setServiceChargeMode(v)}>
                    <SelectTrigger id="serviceChargeMode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serviceChargeValue">
                    Value {serviceChargeMode === "percent" ? "(%)" : "(₱)"}
                  </Label>
                  <Input
                    id="serviceChargeValue"
                    type="number"
                    min={0}
                    step={serviceChargeMode === "percent" ? 0.5 : 1}
                    value={serviceChargeValue}
                    onChange={(e) => setServiceChargeValue(e.target.value)}
                    placeholder={serviceChargeMode === "percent" ? "10" : "50"}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cardSurcharge">Card Surcharge (%)</Label>
                <Input
                  id="cardSurcharge"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={cardSurcharge}
                  onChange={(e) => setCardSurcharge(e.target.value)}
                  placeholder="2"
                />
                <p className="text-xs text-muted-foreground">Extra % when paying by card</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>Preview of applied rates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{taxRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service charge</span>
                <span>{serviceChargeMode === "percent" ? `${serviceChargeValue}%` : `₱${serviceChargeValue}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Card surcharge</span>
                <span>{cardSurcharge}%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
