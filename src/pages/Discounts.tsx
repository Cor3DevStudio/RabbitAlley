import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  tableStickyHeaderRowClassName,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Search, Check, X, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export interface Discount {
  id: string;
  name: string;
  type: "Standalone" | "Applied";
  category?: string | null;
  applicableTo: "Order" | "Product" | "Item" | "Category";
  value: string;
  validFrom?: string | null;
  validTo?: string | null;
  status: "approved" | "pending" | "rejected";
  creator: string;
}

const types = ["Standalone", "Applied"];
const applicableToOptions = ["Order", "Product", "Item", "Category"];
const discountCategories = ["Seasonal", "VIP", "Senior", "PWD", "Happy Hour", "Promo"];

const emptyDiscount = (): Omit<Discount, "id"> => ({
  name: "",
  type: "Standalone",
  category: null,
  applicableTo: "Order",
  value: "",
  validFrom: null,
  validTo: null,
  status: "pending",
  creator: "Admin",
});

export default function Discounts() {
  const { hasPermission } = useAuth();
  const canView = hasPermission("view_discounts");
  const canAddDiscount = hasPermission("request_discounts");
  const canApproveReject = hasPermission("approve_discounts");
  const canManageDiscount = canAddDiscount || canApproveReject;
  const isStaffView = canView && !canAddDiscount && !canApproveReject;

  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState(isStaffView ? "Approved" : "All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [form, setForm] = useState(emptyDiscount());
  const [editForm, setEditForm] = useState(emptyDiscount());
  const [saving, setSaving] = useState(false);

  const loadDiscounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.discounts.list();
      setDiscounts(
        list.map((d) => ({
          id: String(d.id),
          name: d.name,
          type: d.type as "Standalone" | "Applied",
          category: d.category ?? null,
          applicableTo: (d.applicableTo || "Order") as "Order" | "Product" | "Item" | "Category",
          value: d.value,
          validFrom: d.validFrom ?? null,
          validTo: d.validTo ?? null,
          status: d.status as "approved" | "pending" | "rejected",
          creator: d.creator,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load discounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) loadDiscounts();
  }, [canView]);

  if (!canView) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground">You do not have permission to access Discounts.</p>
        </div>
      </AppLayout>
    );
  }

  const filteredDiscounts = discounts.filter((d) => {
    if (isStaffView && d.status !== "approved") return false;
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "All" || d.type === typeFilter;
    const matchesCategory = categoryFilter === "All" || (d.category || "") === categoryFilter;
    const matchesStatus = statusFilter === "All" || d.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesType && matchesCategory && matchesStatus;
  });

  const openAdd = () => {
    setForm(emptyDiscount());
    setAddOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.value.trim()) {
      toast.error("Name and Value are required");
      return;
    }
    setSaving(true);
    try {
      await api.discounts.create({
        name: form.name,
        type: form.type,
        category: form.category || undefined,
        applicableTo: form.applicableTo,
        value: form.value,
        validFrom: form.validFrom || undefined,
        validTo: form.validTo || undefined,
      });
      setAddOpen(false);
      setForm(emptyDiscount());
      toast.success("Discount added");
      loadDiscounts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add discount");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (discount: Discount) => {
    setEditingDiscount(discount);
    setEditForm({
      name: discount.name,
      type: discount.type,
      category: discount.category ?? null,
      applicableTo: discount.applicableTo,
      value: discount.value,
      validFrom: discount.validFrom ?? null,
      validTo: discount.validTo ?? null,
      status: discount.status,
      creator: discount.creator,
    });
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDiscount || !editForm.name.trim() || !editForm.value.trim()) {
      toast.error("Name and Value are required");
      return;
    }
    setSaving(true);
    try {
      await api.discounts.update(editingDiscount.id, {
        name: editForm.name,
        type: editForm.type,
        category: editForm.category || null,
        applicableTo: editForm.applicableTo,
        value: editForm.value,
        validFrom: editForm.validFrom || null,
        validTo: editForm.validTo || null,
        status: editForm.status,
      });
      setEditOpen(false);
      setEditingDiscount(null);
      toast.success("Discount updated");
      loadDiscounts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update discount");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (discount: Discount) => {
    if (!confirm(`Delete discount "${discount.name}"?`)) return;
    try {
      await api.discounts.remove(discount.id);
      toast.success("Discount deleted");
      loadDiscounts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete discount");
    }
  };

  const handleApprove = async (d: Discount) => {
    try {
      await api.discounts.approve(d.id);
      toast.success(`${d.name} approved`);
      loadDiscounts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve");
    }
  };

  const handleReject = async (d: Discount) => {
    try {
      await api.discounts.reject(d.id);
      toast.success(`${d.name} rejected`);
      loadDiscounts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reject");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-success/20 text-success border-success/30">Approved</Badge>;
      case "pending":
        return <Badge className="bg-warning/20 text-warning border-warning/30">Pending</Badge>;
      case "rejected":
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Discounts" description={isStaffView ? "View approved discounts" : "Manage standalone and applied discounts"}>
        {canAddDiscount && (
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Discount
          </Button>
        )}
      </PageHeader>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search discounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {["All", ...types].map((type) => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {["All", ...discountCategories].map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isStaffView && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {["All", "Pending", "Approved", "Rejected"].map((status) => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table wrapperClassName="max-h-[650px]">
          <TableHeader>
            <TableRow className={tableStickyHeaderRowClassName}>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Applicable To</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Valid From</TableHead>
              <TableHead>Valid To</TableHead>
              {!isStaffView && <TableHead>Status</TableHead>}
              {!isStaffView && <TableHead>Creator</TableHead>}
              {canManageDiscount && <TableHead className="w-[140px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={canManageDiscount ? 10 : isStaffView ? 7 : 9} className="text-center py-8 text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : (
              filteredDiscounts.map((discount) => (
                <TableRow key={discount.id}>
                  <TableCell className="font-medium">{discount.name}</TableCell>
                  <TableCell>
                    {discount.category ? (
                      <Badge variant="outline">{discount.category}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{discount.type}</Badge>
                  </TableCell>
                  <TableCell>{discount.applicableTo}</TableCell>
                  <TableCell className="font-mono">{discount.value}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {discount.validFrom ? new Date(discount.validFrom).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {discount.validTo ? new Date(discount.validTo).toLocaleDateString() : "—"}
                  </TableCell>
                  {!isStaffView && <TableCell>{getStatusBadge(discount.status)}</TableCell>}
                  {!isStaffView && <TableCell className="text-muted-foreground">{discount.creator}</TableCell>}
                  {canManageDiscount && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(discount)}
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(discount)}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        {canApproveReject && discount.status === "pending" && (
                          <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                            onClick={() => handleApprove(discount)}
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleReject(discount)}
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Discount</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Create a discount that can be Seasonal, VIP, Senior, PWD, Happy Hour, or Promo. Set validity dates and whether it applies to the whole order or specific products.
            </p>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Discount Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Senior Citizen, VIP Night, Summer Promo"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <p className="text-xs text-muted-foreground">Seasonal, VIP, Senior, PWD, Happy Hour, Promo</p>
                <Select value={form.category || "_none_"} onValueChange={(v) => setForm((f) => ({ ...f, category: v === "_none_" ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">None</SelectItem>
                    {discountCategories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as "Standalone" | "Applied" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {types.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Applicable To</Label>
                <p className="text-xs text-muted-foreground">Order, Product, Item, or Category</p>
                <Select value={form.applicableTo} onValueChange={(v) => setForm((f) => ({ ...f, applicableTo: v as "Order" | "Product" | "Item" | "Category" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {applicableToOptions.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="validFrom">Valid From (optional)</Label>
                <Input
                  id="validFrom"
                  type="date"
                  value={form.validFrom || ""}
                  onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value || null }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validTo">Valid To (optional)</Label>
                <Input
                  id="validTo"
                  type="date"
                  value={form.validTo || ""}
                  onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value || null }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                placeholder="e.g. 20% or ₱500.00"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Adding…" : "Add Discount"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingDiscount(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Discount</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Discount Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={editForm.category || "_none_"}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, category: v === "_none_" ? null : v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">None</SelectItem>
                    {discountCategories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={editForm.type} onValueChange={(v) => setEditForm((f) => ({ ...f, type: v as "Standalone" | "Applied" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {types.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Applicable To</Label>
                <Select
                  value={editForm.applicableTo}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, applicableTo: v as "Order" | "Product" | "Item" | "Category" }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {applicableToOptions.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-valid-from">Valid From</Label>
                <Input
                  id="edit-valid-from"
                  type="date"
                  value={editForm.validFrom || ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, validFrom: e.target.value || null }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-valid-to">Valid To</Label>
                <Input
                  id="edit-valid-to"
                  type="date"
                  value={editForm.validTo || ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, validTo: e.target.value || null }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-value">Value</Label>
              <Input
                id="edit-value"
                value={editForm.value}
                onChange={(e) => setEditForm((f) => ({ ...f, value: e.target.value }))}
                placeholder="e.g. 20% or 200"
              />
            </div>
            {canApproveReject && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, status: v as "approved" | "pending" | "rejected" }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
