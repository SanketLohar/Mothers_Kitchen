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
    <div className={cn("p-5 rounded-2xl border bg-card card-shadow relative overflow-hidden transition-all hover:translate-y-[-2px]")}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {title}
          </p>
          <div className="text-3xl font-extrabold tracking-tight text-foreground">
            {value}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {trend && (
                <span className={cn("inline-flex items-center font-bold", trend > 0 ? "text-emerald-600" : "text-rose-600")}>
                  {trend > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                  {Math.abs(trend)}%
                </span>
              )}
              {subtitle}
            </p>
          )}
        </div>
        <div className={cn("size-12 rounded-2xl flex items-center justify-center shadow-xs", style.iconBg)}>
          <Icon className="size-6" />
        </div>
      </div>
    </div>
  );
}
