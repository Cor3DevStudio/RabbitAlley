import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LogIn, LogOut, Clock, Calendar, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface TodayLog {
  id: number;
  userId: string;
  workDate: string;
  timeIn: string;
  timeOut: string | null;
  breakMinutes: number;
}

export default function Attendance() {
  const { user, hasPermission } = useAuth();
  const canAccess = hasPermission("access_attendance");
  const [todayLog, setTodayLog] = useState<TodayLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [historyFrom, setHistoryFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [historyTo, setHistoryTo] = useState(new Date().toISOString().slice(0, 10));
  const [history, setHistory] = useState<Array<{
    id: number;
    workDate: string;
    timeIn: string;
    timeOut: string | null;
    breakMinutes: number;
  }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  if (!canAccess) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground">You do not have permission to access Attendance.</p>
        </div>
      </AppLayout>
    );
  }

  const loadToday = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const log = await api.attendance.getToday(String(user.id));
      setTodayLog(log ? { ...log, breakMinutes: log.breakMinutes ?? 0 } : null);
    } catch {
      setTodayLog(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const loadHistory = useCallback(async () => {
    if (!user?.id) return;
    setHistoryLoading(true);
    try {
      const list = await api.attendance.list({
        userId: String(user.id),
        from: historyFrom,
        to: historyTo,
      });
      setHistory(
        list.map((a) => ({
          id: a.id,
          workDate: a.workDate,
          timeIn: a.timeIn,
          timeOut: a.timeOut,
          breakMinutes: a.breakMinutes ?? 0,
        }))
      );
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [user?.id, historyFrom, historyTo]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleClockIn = async () => {
    if (!user?.id) return;
    setActionLoading(true);
    try {
      const log = await api.attendance.clockIn(String(user.id));
      setTodayLog({
        id: log.id,
        userId: log.userId,
        workDate: log.workDate,
        timeIn: log.timeIn,
        timeOut: log.timeOut ?? null,
        breakMinutes: log.breakMinutes ?? 0,
      });
      toast.success("Clocked in");
      loadHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clock in");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!user?.id) return;
    setActionLoading(true);
    try {
      const log = await api.attendance.clockOut(String(user.id));
      setTodayLog({
        id: log.id,
        userId: log.userId,
        workDate: log.workDate,
        timeIn: log.timeIn,
        timeOut: log.timeOut,
        breakMinutes: log.breakMinutes ?? 0,
      });
      toast.success("Clocked out");
      loadHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clock out");
    } finally {
      setActionLoading(false);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  if (!user) {
    return (
      <AppLayout>
        <PageHeader title="Attendance" description="Time in / Time out" />
        <p className="text-muted-foreground">Please log in to record attendance.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Attendance"
        description="Clock in and clock out for payroll hours"
      >
        <Button variant="outline" size="sm" onClick={() => { loadToday(); loadHistory(); }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Today
            </CardTitle>
            <CardDescription>
              {formatDate(new Date().toISOString().slice(0, 10))}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : todayLog ? (
              <>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Time in: </span>
                    <span className="font-medium">{formatTime(todayLog.timeIn)}</span>
                  </div>
                  {todayLog.timeOut ? (
                    <div>
                      <span className="text-muted-foreground">Time out: </span>
                      <span className="font-medium">{formatTime(todayLog.timeOut)}</span>
                    </div>
                  ) : (
                    <Badge variant="secondary">Currently clocked in</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {!todayLog.timeOut ? (
                    <Button onClick={handleClockOut} disabled={actionLoading}>
                      <LogOut className="w-4 h-4 mr-2" />
                      Clock out
                    </Button>
                  ) : (
                    <Button onClick={handleClockIn} disabled={actionLoading}>
                      <LogIn className="w-4 h-4 mr-2" />
                      Clock in again (new day tomorrow)
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">No clock-in yet today.</p>
                <Button onClick={handleClockIn} disabled={actionLoading}>
                  <LogIn className="w-4 h-4 mr-2" />
                  Clock in
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              History
            </CardTitle>
            <CardDescription>Past attendance by date range</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">From</span>
              <Input
                type="date"
                value={historyFrom}
                onChange={(e) => setHistoryFrom(e.target.value)}
                className="w-36 h-8 text-sm"
              />
              <span className="text-sm text-muted-foreground">To</span>
              <Input
                type="date"
                value={historyTo}
                onChange={(e) => setHistoryTo(e.target.value)}
                className="w-36 h-8 text-sm"
              />
              <Button variant="outline" size="sm" onClick={loadHistory} disabled={historyLoading}>
                Load
              </Button>
            </div>
            {historyLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No records. Adjust dates and click Load.</p>
            ) : (
              <div className="max-h-64 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time in</TableHead>
                      <TableHead>Time out</TableHead>
                      <TableHead className="text-right">Break (min)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="text-sm">{formatDate(row.workDate)}</TableCell>
                          <TableCell className="text-sm">{formatTime(row.timeIn)}</TableCell>
                          <TableCell className="text-sm">{row.timeOut ? formatTime(row.timeOut) : "—"}</TableCell>
                          <TableCell className="text-right text-sm">{row.breakMinutes}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
