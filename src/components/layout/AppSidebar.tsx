import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  Percent, 
  FileText, 
  Settings,
  LogOut,
  Menu,
  X,
  Rabbit,
  Clock,
  Maximize,
  Minimize,
  LogIn,
  ClipboardList,
  Receipt
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  permission?: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", permission: "view_dashboard" },
  { label: "Point of Sale", icon: ShoppingCart, href: "/pos", permission: "manage_pos" },
  { label: "Products", icon: Package, href: "/products", permission: "manage_products" },
  { label: "Staff", icon: Users, href: "/staff", permission: "manage_staff" },
  { label: "Discounts", icon: Percent, href: "/discounts", permission: "view_discounts" },
  { label: "Reports", icon: FileText, href: "/reports", permission: "view_reports" },
  { label: "Audit Logs", icon: ClipboardList, href: "/audit-logs", permission: "view_audit_logs" },
  { label: "Charge / Utang", icon: Receipt, href: "/charges", permission: "manage_settings" },
  { label: "Shifts", icon: Clock, href: "/shifts", permission: "close_shift" },
  { label: "Attendance", icon: LogIn, href: "/attendance", permission: "access_attendance" },
  { label: "Settings", icon: Settings, href: "/settings", permission: "manage_settings" },
];

export function AppSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const location = useLocation();
  const { user, logout, hasPermission } = useAuth();

  const filteredNavItems = navItems.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  // Check fullscreen state on mount and on change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Toggle fullscreen mode (Kiosk mode)
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary">
          <Rabbit className="w-6 h-6 text-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-sidebar-foreground">Rabbit Alley</span>
          <span className="text-xs text-muted-foreground">Point of Sale</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setIsOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Block */}
      {user && (
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-sidebar-accent text-sidebar-accent-foreground font-medium text-sm">
              {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user.name}
              </p>
              <p className="text-xs text-muted-foreground">{user.employeeId}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-start text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Kiosk Mode (ESC)" : "Enter Kiosk Mode"}
            >
              {isFullscreen ? (
                <>
                  <Minimize className="w-4 h-4 mr-2" />
                  Exit Kiosk
                </>
              ) : (
                <>
                  <Maximize className="w-4 h-4 mr-2" />
                  Kiosk Mode
                </>
              )}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 mt-2"
            onClick={logout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-sidebar flex flex-col border-r border-sidebar-border transition-transform duration-300 lg:translate-x-0 lg:sticky lg:z-0 lg:h-screen flex-shrink-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <NavContent />
      </aside>
    </>
  );
}
