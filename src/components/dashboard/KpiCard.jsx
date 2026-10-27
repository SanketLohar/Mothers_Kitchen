import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const toneStyles = {
  emerald: {
    bg: "bg-emerald-500/10 border-emerald-500/20",
    iconBg: "bg-emerald-600 text-white",
    text: "text-emerald-700",
  },
  blue: {
    bg: "bg-sky-500/10 border-sky-500/20",
    iconBg: "bg-sky-600 text-white",
    text: "text-sky-700",
  },
  orange: {
    bg: "bg-amber-500/10 border-amber-500/20",
    iconBg: "bg-gradient-to-br from-[#E76F51] to-[#D97706] text-white",
    text: "text-amber-800",
  },
  primary: {
    bg: "bg-primary/5 border-primary/20",
    iconBg: "bg-primary text-white",
    text: "text-primary",
  },
};

export function KpiCard({ title, value, icon: Icon, tone = "primary", subtitle, trend }) {
  const style = toneStyles[tone] || toneStyles.primary;

  return (
    <div className={cn("p-3.5 sm:p-4 rounded-xl border border-border bg-card shadow-2xs hover:shadow-xs relative overflow-hidden transition-all hover:translate-y-[-1px] h-full flex flex-col justify-between")}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
            {title}
          </p>
          <div className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground leading-tight">
            {value}
          </div>
        </div>
        <div className={cn("size-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs", style.iconBg)}>
          <Icon className="size-4.5" />
        </div>
      </div>
      {subtitle && (
        <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1 truncate pt-1 border-t border-border/50">
          {trend && (
            <span className={cn("inline-flex items-center font-bold shrink-0", trend > 0 ? "text-emerald-600" : "text-rose-600")}>
              {trend > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {Math.abs(trend)}%
            </span>
          )}
          <span className="truncate">{subtitle}</span>
        </p>
      )}
    </div>
  );
}
