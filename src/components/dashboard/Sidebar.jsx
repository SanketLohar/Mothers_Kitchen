import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  ChefHat,
  Sparkles,
  Users,
  BarChart3,
  Megaphone,
  LogOut,
  ChevronRight,
  ShieldCheck,
  CookingPot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { isFirebaseConfigured, auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

const navItems = [
  { to: "/super-admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/super-admin/society", label: "Society Management", icon: Building2 },
  { to: "/super-admin/chefs", label: "Chef Management", icon: ChefHat },
  { to: "/super-admin/highlights", label: "Customer App Highlights", icon: Sparkles },
  { to: "/super-admin/customers", label: "Customer Database", icon: Users },
  { to: "/super-admin/reports", label: "Statistics and Report", icon: BarChart3 },
  { to: "/super-admin/marketing", label: "Marketing", icon: Megaphone },
];

export function Sidebar({ className }) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (isFirebaseConfigured && auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.error("Sign-out error:", err);
      }
    }
    localStorage.removeItem("mk_admin_session");
    toast.success("Logged out successfully");
    navigate({ to: "/login" });
  };

  return (
    <aside
      className={cn(
        "w-64 shrink-0 flex flex-col h-screen sticky top-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border z-40 transition-all",
        className
      )}
    >
      {/* Brand Header */}
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-to-br from-[#ea580c] to-[#c2410c] text-white flex items-center justify-center shadow-md shadow-orange-500/20">
            <CookingPot className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-base tracking-tight text-foreground font-sans leading-none">
              Mother's Kitchen
            </span>
            <span className="text-[11px] font-bold text-primary tracking-wide mt-1">
              Super Admin Portal
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Core Operations
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.to === "/super-admin"
              ? currentPath === "/super-admin" || currentPath === "/super-admin/"
              : currentPath.startsWith(item.to);

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group",
                isActive
                  ? "bg-primary text-white font-bold shadow-xs shadow-orange-500/25"
                  : "text-foreground/75 hover:bg-sidebar-accent hover:text-primary"
              )}
            >
              <Icon
                className={cn(
                  "size-4.5 shrink-0 transition-colors",
                  isActive ? "text-white" : "text-muted-foreground group-hover:text-primary"
                )}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {isActive && (
                <div className="size-1.5 rounded-full bg-white/90 shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Status Area */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        {/* Environment Status Badge */}
        {!isFirebaseConfigured && (
          <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 text-xs flex items-center gap-2">
            <div className="size-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="truncate font-semibold">Demo Mode (Local Data)</span>
          </div>
        )}

        {/* User & Logout */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-muted/50 border border-border/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-lg bg-primary text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
              SA
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">Super Admin</p>
              <p className="text-[10px] text-muted-foreground truncate">admin@motherskitchen</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
