import { ReactNode, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import {
  PRINT_JOB_ASSIGNMENTS_SETTING_KEY,
  applyPrinterAssignmentsFromSetting,
} from "@/lib/storage-keys";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // Keep print-job assignments in sync across terminals (Manager saves to DB).
  useEffect(() => {
    if (!isAuthenticated) return;
    api.settings
      .get()
      .then((dbSettings) => {
        if (dbSettings[PRINT_JOB_ASSIGNMENTS_SETTING_KEY]) {
          applyPrinterAssignmentsFromSetting(dbSettings[PRINT_JOB_ASSIGNMENTS_SETTING_KEY]);
        }
      })
      .catch(() => {});
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="flex min-h-screen w-full overflow-hidden">
      <AppSidebar />
      <main className="flex-1 min-h-screen lg:ml-0 overflow-auto">
        <div className="p-4 lg:p-6 pt-16 lg:pt-6">
          {children}
        </div>
      </main>
    </div>
  );
}
