import { useCallback, useEffect, useState } from "react";
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
import { Filter, RefreshCw, ClipboardList } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const today = new Date().toISOString().split("T")[0];
const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

interface AuditLogEntry {
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
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatAction(action: string) {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AuditLogs() {
  const { hasPermission } = useAuth();
  const canView = hasPermission("view_audit_logs");
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(weekAgo);
  const [dateTo, setDateTo] = useState(today);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.auditLogs.list({
        from: dateFrom,
        to: dateTo,
        employeeId: employeeFilter.trim() || undefined,
        action: actionFilter.trim() || undefined,
        limit: 300,
      });
      setLogs(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit logs");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, employeeFilter, actionFilter]);

  useEffect(() => {
    if (canView) loadLogs();
  }, [canView, loadLogs]);

  if (!canView) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ClipboardList className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">You do not have permission to view Audit Logs.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Audit Logs"
        description="Track all employee actions (orders, payments, products, discounts, etc.)"
      />
      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
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
        <Input
          placeholder="Employee ID"
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="w-32"
        />
        <Input
          placeholder="Action (e.g. order_create)"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="w-40"
        />
        <Button variant="secondary" onClick={loadLogs}>
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
        <Button variant="outline" size="icon" onClick={loadLogs} title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Time</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead className="max-w-[200px]">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No audit logs found.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{log.employeeId || "—"}</span>
                    {log.userName && (
                      <span className="block text-xs text-muted-foreground">{log.userName}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{log.roleName || "—"}</TableCell>
                  <TableCell>
                    <span className="font-medium">{formatAction(log.action)}</span>
                  </TableCell>
                  <TableCell>
                    {log.entityType && (
                      <span className="text-sm">
                        {log.entityType}
                        {log.entityId && ` #${log.entityId}`}
                      </span>
                    )}
                    {!log.entityType && "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {log.details && Object.keys(log.details).length > 0
                      ? JSON.stringify(log.details)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
