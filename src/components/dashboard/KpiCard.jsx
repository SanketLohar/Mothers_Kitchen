import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const toneStyles = {
  blue: {
    iconBg: "bg-gradient-to-br from-sky-400 via-sky-500 to-blue-600 shadow-sky-500/25",
    glow: "from-sky-500/15 via-sky-500/5 to-transparent",
    tag: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
    borderHover: "hover:border-sky-500/40",
  },
  emerald: {
    iconBg: "bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 shadow-emerald-500/25",
    glow: "from-emerald-500/15 via-emerald-500/5 to-transparent",
    tag: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    borderHover: "hover:border-emerald-500/40",
  },
  purple: {
    iconBg: "bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 shadow-purple-500/25",
    glow: "from-purple-500/15 via-purple-500/5 to-transparent",
    tag: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
    borderHover: "hover:border-purple-500/40",
  },
  orange: {
    iconBg: "bg-gradient-to-br from-orange-400 via-[#E76F51] to-amber-600 shadow-orange-500/25",
    glow: "from-orange-500/15 via-orange-500/5 to-transparent",
    tag: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20",
    borderHover: "hover:border-orange-500/40",
  },
  amber: {
    iconBg: "bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 shadow-amber-500/25",
    glow: "from-amber-500/15 via-amber-500/5 to-transparent",
    tag: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    borderHover: "hover:border-amber-500/40",
  },
  primary: {
    iconBg: "bg-gradient-to-br from-primary via-primary to-primary/80 shadow-primary/25",
    glow: "from-primary/15 via-primary/5 to-transparent",
    tag: "bg-primary/10 text-primary border-primary/20",
    borderHover: "hover:border-primary/40",
  },
};

export function KpiCard({ title, value, icon: Icon, tone = "primary", subtitle, trend, tag }) {
  const style = toneStyles[tone] || toneStyles.primary;

  return (
    <div
      className={cn(
        "group relative p-4 sm:p-5 rounded-2xl border border-border/80 bg-card/95 shadow-2xs hover:shadow-md transition-all duration-300 hover:-translate-y-1 overflow-hidden h-full flex items-center gap-4",
        style.borderHover
      )}
    >
      {/* Ambient gradient corner glow */}
      <div
        className={cn(
          "absolute -bottom-8 -right-8 size-36 rounded-full bg-gradient-to-tl opacity-50 group-hover:opacity-80 blur-xl pointer-events-none transition-all duration-500",
          style.glow
        )}
      />

      {/* Artistic oversized watermark icon */}
      <Icon
        className="size-24 absolute -right-3 -bottom-3 text-foreground opacity-[0.04] group-hover:opacity-[0.09] group-hover:scale-110 pointer-events-none transition-all duration-500"
        aria-hidden="true"
      />

      {/* 3D Vibrant Squircle Icon */}
      <div
        className={cn(
          "size-12 rounded-xl flex items-center justify-center shrink-0 shadow-md text-white z-10 transition-transform duration-300 group-hover:scale-105",
          style.iconBg
        )}
      >
        <Icon className="size-6 text-white drop-shadow-xs" />
      </div>

      {/* Metric Content */}
      <div className="space-y-0.5 min-w-0 z-10 flex-1">
        <div className="flex items-center justify-between gap-1.5">
          <p className="text-xs sm:text-[13px] font-bold text-muted-foreground uppercase tracking-wider truncate">
            {title}
          </p>
          {tag && (
            <span
              className={cn(
                "hidden sm:inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 transition-opacity",
                style.tag
              )}
            >
              {tag}
            </span>
          )}
        </div>

        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
          {value}
        </div>

        {subtitle && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate pt-0.5">
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center font-bold shrink-0",
                  trend > 0 ? "text-emerald-600" : "text-rose-600"
                )}
              >
                {trend > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                {Math.abs(trend)}%
              </span>
            )}
            <span className="truncate">{subtitle}</span>
          </p>
        )}
      </div>
    </div>
  );
}
