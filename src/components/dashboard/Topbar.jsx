import { Bell, Search, ShieldCheck, AlertCircle, Database } from "lucide-react";
import { isFirebaseConfigured } from "@/lib/firebase";

export function Topbar({ title, subtitle, headerAction }) {
  return (
    <header className="sticky top-0 z-30 flex flex-col bg-card/95 backdrop-blur-md border-b border-border">
      {/* Setup / Demo Status Banner */}
      {!isFirebaseConfigured && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-xs text-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="size-3.5 text-amber-600 shrink-0" />
            <span className="font-medium">
              Running with Mother's Kitchen <strong>Demo Data</strong>. Firebase environment variables are unconfigured.
            </span>
          </div>
          <span className="text-[11px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-semibold">
            Ready for Mother's Kitchen Firebase Web App
          </span>
        </div>
      )}

      {/* Main Topbar */}
      <div className="h-16 px-6 flex items-center justify-between gap-4">
        {/* Title & Subtitle */}
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {headerAction}

          {/* Notifications Placeholder */}
          <button
            type="button"
            className="size-9 rounded-xl border border-border bg-card text-muted-foreground hover:text-primary flex items-center justify-center transition-colors relative cursor-pointer"
            title="Notifications"
          >
            <Bell className="size-4" />
            <span className="absolute top-2 right-2 size-2 rounded-full bg-primary" />
          </button>

          {/* Admin Avatar Pill */}
          <div className="flex items-center gap-2.5 pl-3 border-l border-border">
            <div className="size-8 rounded-full bg-primary/15 border border-primary/30 text-primary font-bold text-xs flex items-center justify-center">
              AD
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-foreground leading-tight">Admin</div>
              <div className="text-[10px] text-muted-foreground">Super Admin</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
