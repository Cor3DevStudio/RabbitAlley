import { useEffect, useMemo, useState } from "react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, Edit, MoreHorizontal, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { type Product } from "@/types/pos";
import { formatCurrency } from "@/lib/utils";
export type { Product };

const departments = ["Bar", "Kitchen", "LD"];

type ProductForm = Omit<Product, "id"> & {
  pricesByArea?: { Lounge?: number | ""; Club?: number | ""; LD?: number | "" };
};

const emptyProduct = (): ProductForm => ({
  sku: "",
  name: "",
  description: "",
  category: "General",
  sub_category: "",
  department: "Bar",
  price: 0,
  cost: 0,
  commission: 0,
  status: "active",
  pricesByArea: { Lounge: "", Club: "", LD: "" },
});

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyProduct());
  const [saving, setSaving] = useState(false);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.products.list();
      setProducts(
        list.map((p) => ({
          id: String(p.id),
          sku: p.sku,
          name: p.name,
          description: p.description ?? "",
          category: p.category,
          sub_category: (p as { sub_category?: string }).sub_category ?? "",
          department: p.department,
          price: Number(p.price),
          cost: Number(p.cost),
          commission: Number(p.commission),
          status: p.status as "active" | "inactive",
          pricesByArea: (p as { pricesByArea?: { Lounge?: number; Club?: number; LD?: number } }).pricesByArea,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const categoryOptions = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products]
  );
  const subCategoryOptions = useMemo(
    () => [...new Set(products.filter((p) => p.category === form.category).map((p) => (p as Product & { sub_category?: string }).sub_category).filter(Boolean))].sort() as string[],
    [products, form.category]
  );

  const filteredProducts = useMemo(
    () =>
      products.filter((p) => {
        const matchesSearch =
          !search.trim() ||
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.sku.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = categoryFilter === "All" || p.category === categoryFilter;
        const matchesDepartment = departmentFilter === "All" || p.department === departmentFilter;
        return matchesSearch && matchesCategory && matchesDepartment;
      }),
    [products, search, categoryFilter, departmentFilter]
  );

  const openAdd = () => {
    setForm((prev) => ({ ...emptyProduct(), category: categoryOptions[0] || prev.category || "General", pricesByArea: { Lounge: "", Club: "", LD: "" } }));
    setAddOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setForm({
      sku: product.sku,
      name: product.name,
      description: product.description ?? "",
      category: product.category,
      sub_category: product.sub_category ?? "",
      department: product.department,
      price: product.price,
      cost: product.cost,
      commission: product.commission,
      status: product.status,
      pricesByArea: {
        Lounge: product.pricesByArea?.Lounge ?? "",
        Club: product.pricesByArea?.Club ?? "",
        LD: product.pricesByArea?.LD ?? "",
      },
    });
    setEditOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku.trim() || !form.name.trim()) {
      toast.error("SKU and Name are required");
      return;
    }
    setSaving(true);
    try {
      const pricesByArea: { Lounge?: number; Club?: number; LD?: number } = {};
      if (form.pricesByArea?.Lounge !== "" && form.pricesByArea?.Lounge != null) pricesByArea.Lounge = Number(form.pricesByArea.Lounge);
      if (form.pricesByArea?.Club !== "" && form.pricesByArea?.Club != null) pricesByArea.Club = Number(form.pricesByArea.Club);
      if (form.pricesByArea?.LD !== "" && form.pricesByArea?.LD != null) pricesByArea.LD = Number(form.pricesByArea.LD);
      await api.products.create({ ...form, sub_category: form.sub_category?.trim() || undefined, pricesByArea: Object.keys(pricesByArea).length ? pricesByArea : undefined });
      setAddOpen(false);
      setForm(emptyProduct());
      toast.success("Product added");
      loadProducts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add product");
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !form.sku.trim() || !form.name.trim()) return;
    setSaving(true);
    try {
      const pricesByArea: { Lounge?: number; Club?: number; LD?: number } = {};
      if (form.pricesByArea?.Lounge !== "" && form.pricesByArea?.Lounge != null) pricesByArea.Lounge = Number(form.pricesByArea.Lounge);
      if (form.pricesByArea?.Club !== "" && form.pricesByArea?.Club != null) pricesByArea.Club = Number(form.pricesByArea.Club);
      if (form.pricesByArea?.LD !== "" && form.pricesByArea?.LD != null) pricesByArea.LD = Number(form.pricesByArea.LD);
      await api.products.update(editingProduct.id, { ...form, sub_category: form.sub_category?.trim() || undefined, pricesByArea });
      setEditOpen(false);
      setEditingProduct(null);
      setForm(emptyProduct());
      toast.success("Product updated");
      loadProducts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (product: Product) => {
    try {
      await api.products.setStatus(product.id, "inactive");
      toast.success(`${product.name} deactivated`);
      loadProducts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  };

  const handleActivate = async (product: Product) => {
    try {
      await api.products.setStatus(product.id, "active");
      toast.success(`${product.name} activated`);
      loadProducts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  };

  const formFields = (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sku">SKU (Stock Keeping Unit)</Label>
          <Input
            id="sku"
            value={form.sku}
            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
            placeholder="e.g. SMB-001"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Product Name</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Product name"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          value={form.description ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Short description or notes"
          rows={3}
          className="resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <p className="text-xs text-muted-foreground">Choose existing or type a new category (e.g. Chickenjoy)</p>
          <Input
            id="category"
            list="product-category-options"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            placeholder="e.g. Beers, Chickenjoy, LD"
          />
          <datalist id="product-category-options">
            {categoryOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sub_category">Sub-category (optional)</Label>
          <p className="text-xs text-muted-foreground">Options under this category (e.g. 1pc, 2pc, Gravy, Spicy)</p>
          <Input
            id="sub_category"
            list="product-subcategory-options"
            value={form.sub_category ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, sub_category: e.target.value }))}
            placeholder="e.g. 1pc, 2pc, Gravy"
          />
          <datalist id="product-subcategory-options">
            {subCategoryOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label>Department</Label>
          <p className="text-xs text-muted-foreground">Bar, Kitchen, or LD</p>
          <Select value={form.department} onValueChange={(v) => setForm((f) => ({ ...f, department: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price">Base price (₱)</Label>
          <p className="text-xs text-muted-foreground">Default price; used when no area override</p>
          <Input
            id="price"
            type="number"
            min={0}
            step={0.01}
            value={form.price || ""}
            onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) || 0 }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cost">Cost (₱)</Label>
          <Input
            id="cost"
            type="number"
            min={0}
            step={0.01}
            value={form.cost || ""}
            onChange={(e) => setForm((f) => ({ ...f, cost: Number(e.target.value) || 0 }))}
          />
        </div>
      </div>
      <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
        <p className="text-sm font-medium">Prices by area (optional)</p>
        <p className="text-xs text-muted-foreground">Override price per area. Leave blank to use base price (e.g. Lounge ₱50, Club ₱75).</p>
        <div className="grid grid-cols-3 gap-3 mt-2">
          <div className="space-y-1">
            <Label htmlFor="priceLounge" className="text-xs">Lounge (₱)</Label>
            <Input
              id="priceLounge"
              type="number"
              min={0}
              step={0.01}
              placeholder="Base"
              value={form.pricesByArea?.Lounge === "" || form.pricesByArea?.Lounge == null ? "" : form.pricesByArea?.Lounge}
              onChange={(e) => setForm((f) => ({ ...f, pricesByArea: { ...f.pricesByArea, Lounge: e.target.value === "" ? "" : Number(e.target.value) } }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="priceClub" className="text-xs">Club (₱)</Label>
            <Input
              id="priceClub"
              type="number"
              min={0}
              step={0.01}
              placeholder="Base"
              value={form.pricesByArea?.Club === "" || form.pricesByArea?.Club == null ? "" : form.pricesByArea?.Club}
              onChange={(e) => setForm((f) => ({ ...f, pricesByArea: { ...f.pricesByArea, Club: e.target.value === "" ? "" : Number(e.target.value) } }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="priceLD" className="text-xs">LD (₱)</Label>
            <Input
              id="priceLD"
              type="number"
              min={0}
              step={0.01}
              placeholder="Base"
              value={form.pricesByArea?.LD === "" || form.pricesByArea?.LD == null ? "" : form.pricesByArea?.LD}
              onChange={(e) => setForm((f) => ({ ...f, pricesByArea: { ...f.pricesByArea, LD: e.target.value === "" ? "" : Number(e.target.value) } }))}
            />
          </div>
        </div>
      </div>
      {editOpen && (
        <div className="space-y-2">
          <Label>Status</Label>
          <p className="text-xs text-muted-foreground">Active products appear in POS</p>
          <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as "active" | "inactive" }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );

  return (
    <AppLayout>
      <PageHeader title="Products" description="Manage your product catalog">
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
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
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {["All", ...categoryOptions].map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            {["All", ...departments].map((dept) => (
              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border overflow-hidden max-h-[650px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/95 z-10">
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
                <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell>{product.department}</TableCell>
                  <TableCell className="text-right">{formatCurrency(product.price)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatCurrency(product.cost)}</TableCell>
                  <TableCell>
                    <Badge variant={product.status === "active" ? "default" : "secondary"}>
                      {product.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(product)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {product.status === "active" ? (
                          <DropdownMenuItem onClick={() => handleDeactivate(product)} className="text-destructive">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Deactivate
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleActivate(product)}>
                            Activate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            {formFields}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Adding…" : "Add Product"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditingProduct(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {formFields}
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
