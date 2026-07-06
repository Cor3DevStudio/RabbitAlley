import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  tableStickyHeaderRowClassName,
} from "@/components/ui/table";
import { Search, TableProperties, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { mapApiTable } from "@/types/pos";
import type { Table as PosTable } from "@/types/pos";

interface WaiterRow {
  id: string;
  code: string;
  name: string;
  status: string;
  assignedTables: Array<{ tableId: string; tableName: string; area: string }>;
}

const AREA_ORDER = ["Lounge", "Club", "LD"] as const;

export default function TableAssignments() {
  const [waiters, setWaiters] = useState<WaiterRow[]>([]);
  const [allTables, setAllTables] = useState<PosTable[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [open, setOpen] = useState(false);
  const [editingWaiter, setEditingWaiter] = useState<WaiterRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [waitersRes, tablesRes] = await Promise.all([
        api.assignments.getWaitersWithTables(),
        api.dashboard.tables(),
      ]);
      setWaiters(waitersRes);
      // Only show floor tables (Lounge + Club) for assignment
      setAllTables(tablesRes.map(mapApiTable).filter((t) => t.area !== "LD"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAssign = (waiter: WaiterRow) => {
    setEditingWaiter(waiter);
    setSelected(new Set(waiter.assignedTables.map((t) => t.tableId)));
    setOpen(true);
  };

  const toggleTable = (tableId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!editingWaiter) return;
    setSaving(true);
    try {
      await api.assignments.save(editingWaiter.id, Array.from(selected));
      toast.success(`Tables assigned to ${editingWaiter.name}`);
      setOpen(false);
      loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save assignments");
    } finally {
      setSaving(false);
    }
  };

  const filtered = waiters.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.code.toLowerCase().includes(search.toLowerCase())
  );

  // Group allTables by area for the dialog
  const tablesByArea = AREA_ORDER.reduce<Record<string, PosTable[]>>((acc, area) => {
    const group = allTables.filter((t) => t.area === area);
    if (group.length > 0) acc[area] = group;
    return acc;
  }, {});

  return (
    <AppLayout>
      <PageHeader
        title="Table Assignments"
        description="Assign specific tables to each waiter. Waiters can only see and use their assigned tables."
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search waiter name or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted">
              <UserCheck className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No waiters found</p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className={tableStickyHeaderRowClassName}>
                  <TableHead>Waiter</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Assigned Tables</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((waiter) => (
                  <TableRow key={waiter.id}>
                    <TableCell className="font-medium">{waiter.name}</TableCell>
                    <TableCell className="text-muted-foreground">{waiter.code}</TableCell>
                    <TableCell>
                      {waiter.assignedTables.length === 0 ? (
                        <span className="text-sm text-muted-foreground italic">None assigned</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {waiter.assignedTables.map((t) => (
                            <Badge key={t.tableId} variant="secondary">
                              {t.area} · {t.tableName}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openAssign(waiter)}>
                        <TableProperties className="w-4 h-4 mr-1" />
                        Assign Tables
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingWaiter(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Tables — {editingWaiter?.name}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Select which tables this waiter is responsible for. Uncheck all to remove all assignments.
            </p>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {allTables.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No tables configured yet.
              </p>
            ) : (
              Object.entries(tablesByArea).map(([area, tables]) => (
                <div key={area} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {area}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {tables.map((table) => {
                      const checked = selected.has(table.id);
                      return (
                        <label
                          key={table.id}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                            checked
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/50"
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleTable(table.id)}
                          />
                          <span className="text-sm font-medium">{table.name}</span>
                          {table.status === "occupied" && (
                            <Badge variant="outline" className="ml-auto text-xs">Occupied</Badge>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : `Save (${selected.size} table${selected.size !== 1 ? "s" : ""})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
