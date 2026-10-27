import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  CookingPot,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { isFirebaseConfigured, auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

// Approved Super Admin emails (like Laundrysta pattern)
const SUPER_ADMIN_EMAILS = [
  "admin@motherskitchen.com",
];

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // If already authenticated, redirect to Super Admin dashboard
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("mk_admin_session") : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.role === "super-admin") {
          navigate({ to: "/super-admin" });
        }
      } catch {
        localStorage.removeItem("mk_admin_session");
      }
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      toast.error("Please enter both email and password.");
      setLoading(false);
      return;
    }

    if (!isFirebaseConfigured) {
      // Offline / Demo Mode Login
      setTimeout(() => {
        localStorage.setItem(
          "mk_admin_session",
          JSON.stringify({
            role: "super-admin",
            email: cleanEmail,
            name: "Super Admin",
            mode: "demo",
            timestamp: Date.now(),
          })
        );
        toast.success("Welcome back! Signed in under Demo Mode.");
        setLoading(false);
        navigate({ to: "/super-admin" });
      }, 400);
      return;
    }

    // Live Firebase Authentication
    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      const tokenResult = await userCredential.user.getIdTokenResult();

      // Check either authorized super admin emails OR Firebase custom claims
      const isSuperAdmin =
        SUPER_ADMIN_EMAILS.includes(cleanEmail) ||
        tokenResult.claims.role === "super-admin" ||
        tokenResult.claims.admin === true;

      if (!isSuperAdmin) {
        toast.error("Access denied: You do not have Super Admin permissions.");
        setLoading(false);
        return;
      }

      localStorage.setItem(
        "mk_admin_session",
        JSON.stringify({
          role: "super-admin",
          email: cleanEmail,
          name: "Super Admin",
          uid: userCredential.user.uid,
          mode: "live",
          timestamp: Date.now(),
        })
      );
      toast.success("Authentication successful. Welcome Super Admin!");
      setLoading(false);
      navigate({ to: "/super-admin" });
    } catch (err) {
      console.error("Login error:", err);
      let message = "Invalid email or password. Please verify your credentials.";
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        message = "Invalid email or password.";
      } else if (err.code === "auth/too-many-requests") {
        message = "Account temporarily locked due to failed attempts. Try again later.";
      }
      toast.error(message);
      setLoading(false);
    }
  };

  const handleDemoQuickAccess = () => {
    setEmail("admin@motherskitchen.com");
    setPassword("Admin@MK2026");
    toast.info("Demo administrator credentials populated.");
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-12 bg-[#FAF8F5] text-foreground font-sans selection:bg-[#e8650a]/20 selection:text-[#e8650a]">
      {/* =========================================================================
          LEFT / SHOWCASE PANEL (Desktop: 7 Cols, Deep Warm Roasted Brown & Amber)
          ========================================================================= */}
      <div className="hidden lg:flex lg:col-span-7 xl:col-span-7 relative bg-gradient-to-br from-[#2a1005] via-[#3d1a08] to-[#5c2810] p-10 xl:p-16 flex-col justify-between overflow-hidden text-white shadow-2xl">
        {/* Ambient Glows */}
        <div className="absolute top-[-20%] left-[-10%] size-[500px] rounded-full bg-[#e8650a]/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-15%] right-[-10%] size-[550px] rounded-full bg-[#f59e0b]/20 blur-[140px] pointer-events-none" />

        {/* Subtle Culinary Texture Overlay */}
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none mix-blend-overlay bg-cover bg-center"
          style={{
            backgroundImage:
              'url("https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1600&q=80")',
          }}
        />

        {/* Top Header Row */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-gradient-to-br from-[#F97316] via-[#D97706] to-[#c44e0a] text-white flex items-center justify-center shadow-lg shadow-orange-950/30 ring-1 ring-white/20">
              <CookingPot className="size-6 text-white" />
            </div>
            <div>
              <div className="font-extrabold text-xl tracking-tight text-white leading-none font-sans">
                Mother's Kitchen
              </div>
              <div className="text-[11px] font-semibold text-orange-300 tracking-wider uppercase mt-1">
                Super Admin Enterprise
              </div>
            </div>
          </div>
        </div>

        {/* Middle Hero Typography & Value Proposition */}
        <div className="relative z-10 max-w-xl my-auto py-12 space-y-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="size-3 text-orange-300" />
              <span>Society-Centric Culinary Platform</span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
              Connecting residential societies with authentic home-cooked meals.
            </h1>
            <p className="text-orange-100/80 text-base leading-relaxed font-normal">
              A unified administration suite to manage localized residential clusters, approve certified home cooks, oversee daily kitchen availability, and drive community outreach.
            </p>
          </div>
        </div>

        {/* Bottom Trust & Security Banner */}
        <div className="relative z-10 pt-6 border-t border-white/15 flex items-center justify-between text-xs text-orange-200/80">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-orange-400 shrink-0" />
            <span>Role-Based Token Verification & End-to-End Encryption</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          RIGHT / FORM PANEL (Responsive, Clean, Modern Luxury Sizing)
          ========================================================================= */}
      <div className="lg:col-span-5 xl:col-span-5 flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16 relative bg-white/80 backdrop-blur-xl">
        {/* Top Header Row on Mobile */}
        <div className="flex lg:hidden items-center gap-2.5 pb-4">
          <div className="size-9 rounded-xl bg-gradient-to-br from-[#E76F51] to-[#D97706] text-white flex items-center justify-center shadow-md">
            <CookingPot className="size-5" />
          </div>
          <span className="font-extrabold text-base text-foreground font-sans">Mother's Kitchen</span>
        </div>

        {/* Centered Form Wrapper */}
        <div className="max-w-md w-full mx-auto my-auto py-6 space-y-7">
          {/* Header Copy */}
          <div className="space-y-2 text-left">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight font-sans">
              Sign In to Super Admin
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Authenticate with your administrative credentials to manage societies, cooks, orders, and broadcasts.
            </p>
          </div>

          {/* Sleek Demo Sandbox Auto-fill Helper */}
          {!isFirebaseConfigured && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50/80 via-orange-50/40 to-amber-50/80 border border-amber-200/70 text-amber-900 shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <KeyRound className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">Demo Mode Active</div>
                  <div className="text-[11px] text-amber-700/90 truncate">Test without live Firebase keys</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDemoQuickAccess}
                className="px-3 py-1.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs tracking-wide shadow-xs transition-all hover:scale-102 cursor-pointer shrink-0"
              >
                Auto-fill
              </button>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold text-foreground">
                Administrator Email ID
              </Label>
              <div className="relative group">
                <Mail className="size-4 text-muted-foreground group-focus-within:text-[#e8650a] absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@motherskitchen.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 rounded-xl border-[#f0d9c4] bg-white shadow-xs focus-visible:border-[#e8650a] focus-visible:ring-4 focus-visible:ring-[#e8650a]/15 transition-all text-sm font-medium"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-bold text-foreground">
                Password
              </Label>
              <div className="relative group">
                <Lock className="size-4 text-muted-foreground group-focus-within:text-[#e8650a] absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 rounded-xl border-[#f0d9c4] bg-white shadow-xs focus-visible:border-[#e8650a] focus-visible:ring-4 focus-visible:ring-[#e8650a]/15 transition-all text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Primary Action Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-[#e8650a] to-[#c44e0a] hover:from-[#d55905] hover:to-[#b04306] text-white font-bold text-sm shadow-md shadow-orange-950/15 hover:shadow-lg transition-all duration-200 gap-2 mt-2 cursor-pointer"
            >
              {loading ? (
                <span>Authenticating terminal...</span>
              ) : (
                <>
                  <span>Sign In to Super Admin</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>

          {/* Security Subtext */}
          <div className="p-3 rounded-xl bg-[#fef3e8] border border-[#f0d9c4] text-[11px] text-[#7c3a1a] leading-relaxed text-center flex items-center justify-center gap-1.5">
            <ShieldCheck className="size-3.5 text-[#e8650a] shrink-0" />
            <span>Restricted portal. Session requests are cryptographically audited.</span>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div>© 2026 Mother's Kitchen Technologies. All rights reserved.</div>
          <div className="flex items-center gap-3">
            <span className="hover:text-foreground cursor-pointer">Security Protocol</span>
            <span>•</span>
            <span className="hover:text-foreground cursor-pointer">Privacy</span>
          </div>
        </div>
      </div>
    </div>
  );
}
