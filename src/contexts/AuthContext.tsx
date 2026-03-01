import { createContext, useContext, useState, ReactNode } from "react";
import { STORAGE_USER, STORAGE_PERMISSIONS } from "@/lib/storage-keys";

/** Role names exactly as stored in the database (PascalCase). */
export type UserRole = "Administrator" | "Staff" | "Operations Staff" | string;

export interface User {
  id: string;
  employeeId: string;
  name: string;
  role: UserRole;
  email?: string;
  /** Multi-branch: branch the user is assigned to */
  branchId?: string;
  branchName?: string;
  branchCode?: string;
}

export interface LoginResult {
  success: boolean;
  user?: User;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (employeeId: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_USER);
    return saved ? JSON.parse(saved) : null;
  });
  const [permissions, setPermissions] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_PERMISSIONS);
    return saved ? JSON.parse(saved) : [];
  });

  const login = async (employeeId: string, password: string): Promise<LoginResult> => {
    const apiBase = import.meta.env.VITE_API_URL || "";
    const res = await fetch(`${apiBase}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: employeeId.trim(), password }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { success: false };
    }

    if (data.user && Array.isArray(data.permissions)) {
      setUser(data.user);
      setPermissions(data.permissions);
      localStorage.setItem(STORAGE_USER, JSON.stringify(data.user));
      localStorage.setItem(STORAGE_PERMISSIONS, JSON.stringify(data.permissions));
      return { success: true, user: data.user };
    }
    return { success: false };
  };

  const logout = () => {
    setUser(null);
    setPermissions([]);
    localStorage.removeItem(STORAGE_USER);
    localStorage.removeItem(STORAGE_PERMISSIONS);
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    return permissions.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
