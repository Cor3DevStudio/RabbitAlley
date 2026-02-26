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
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api, RECEIPT_PRINTER_STORAGE_KEY } from "@/lib/api";
import { getPosSettings, savePosSettings } from "@/lib/posSettings";

export default function Settings() {
  const local = getPosSettings();
  const [businessName, setBusinessName] = useState(local.businessName);
  const [address, setAddress] = useState(local.address);
  const [contact, setContact] = useState(local.contact);
  const [receiptFooter, setReceiptFooter] = useState(local.receiptFooter);
  const [taxRate, setTaxRate] = useState(String(local.taxRate));
  const [serviceChargeMode, setServiceChargeMode] = useState<"percent" | "fixed">(local.serviceChargeMode);
  const [serviceChargeValue, setServiceChargeValue] = useState(String(local.serviceChargeValue));
  const [cardSurcharge, setCardSurcharge] = useState(String(local.cardSurcharge));
  const [isSaving, setIsSaving] = useState(false);
  const [printers, setPrinters] = useState<Array<{ name: string; isDefault?: boolean }>>([]);
  const [printersError, setPrintersError] = useState<string | null>(null);
  const [receiptPrinter, setReceiptPrinter] = useState<string>(() => localStorage.getItem(RECEIPT_PRINTER_STORAGE_KEY) || "");

  // Fetch settings from DB on mount and merge into local state (DB is source of truth)
  useEffect(() => {
    api.settings.get().then((dbSettings) => {
      const merged = {
        businessName: dbSettings.business_name ?? local.businessName,
        address: dbSettings.business_address ?? local.address,
        contact: dbSettings.business_contact ?? local.contact,
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
        const saved = localStorage.getItem(RECEIPT_PRINTER_STORAGE_KEY);
        if (saved) setReceiptPrinter(saved);
        else if (res.printers?.length) {
          const defaultOne = res.printers.find((p) => p.isDefault);
          setReceiptPrinter(defaultOne?.name || res.printers[0].name || "");
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Receipt Settings</CardTitle>
              <CardDescription>Customize your printed receipts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Receipt printer (automatic print)</Label>
                <Select
                  value={receiptPrinter || "_none"}
                  onValueChange={(v) => {
                    const name = v === "_none" ? "" : v;
                    setReceiptPrinter(name);
                    if (name) localStorage.setItem(RECEIPT_PRINTER_STORAGE_KEY, name);
                    else localStorage.removeItem(RECEIPT_PRINTER_STORAGE_KEY);
                    toast.success(name ? `Receipts will print to ${name}` : "Receipt printer cleared");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select printer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">No automatic print (use «Print receipt» in POS)</SelectItem>
                    {printers.map((p) => (
                      <SelectItem key={p.name} value={p.name}>
                        {(p as { displayName?: string }).displayName || p.name}
                        {p.isDefault ? " (default)" : ""}
                        {(p as { isNetwork?: boolean }).isNetwork ? " — from server config" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {printersError && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">{printersError}</p>
                )}
                {printers.length === 0 && !printersError && (
                  <p className="text-xs text-muted-foreground">Loading printers…</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Choose a printer for automatic receipts. <strong>Ethernet printers:</strong> set <code className="bg-muted px-1 rounded">PRINTER_INTERFACE=tcp://IP:9100</code> in <code className="bg-muted px-1 rounded">server/.env</code> (e.g. <code className="bg-muted px-1 rounded">tcp://192.168.1.100:9100</code>), then restart the server — it will appear here as &quot;Ethernet (IP:9100)&quot;.
                </p>
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

        {/* Right panel: Tax & Charges */}
        <div className="space-y-6">
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
