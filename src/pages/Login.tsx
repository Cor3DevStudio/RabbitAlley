import { useState } from "react";
import { useNavigate, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Rabbit, AlertCircle } from "lucide-react";

export default function Login() {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || "/dashboard";

  // Staff (waiters) should land on POS, not dashboard or discounts
  const getPostLoginPath = (role: string | undefined) => {
    if (role === "Staff") return "/pos";
    return from;
  };

  if (isAuthenticated) {
    return <Navigate to={getPostLoginPath(user?.role)} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    // Validation
    const newErrors: string[] = [];
    if (!employeeId.trim()) {
      newErrors.push("Employee ID is required");
    }
    if (!password.trim()) {
      newErrors.push("Password is required");
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    const result = await login(employeeId, password);
    setIsLoading(false);

    if (result.success) {
      const targetPath = result.user?.role === "Staff" ? "/pos" : from;
      navigate(targetPath, { replace: true });
    } else {
      setErrors(["Invalid Employee ID or Password"]);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo & Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-black mb-4">
            <Rabbit className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-black">Rabbit Alley</h1>
          <p className="text-gray-500 mt-1">Garden Bar & Bistro</p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg">
          <h2 className="text-lg font-medium mb-6 text-center text-black">Sign In</h2>

          {/* Error Messages */}
          {errors.length > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
              {errors.map((error, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employeeId" className="text-black">Employee ID</Label>
              <Input
                id="employeeId"
                type="text"
                placeholder="e.g., MGR001"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                autoComplete="username"
                className="bg-white border-gray-300 focus:border-black focus:ring-black"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-black">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="bg-white border-gray-300 focus:border-black focus:ring-black"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="rememberMe"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                className="border-gray-300 data-[state=checked]:bg-black data-[state=checked]:border-black"
              />
              <Label htmlFor="rememberMe" className="text-sm font-normal cursor-pointer text-gray-600">
                Remember me
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full bg-black hover:bg-gray-800 text-white"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </div>
      </div>

      {/* Credit Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-gray-400">
          Powered by{" "}
          <span className="font-semibold text-gray-600">CoreDev Studio</span>
        </p>
      </div>
    </div>
  );
}
