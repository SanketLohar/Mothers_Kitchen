import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary border border-primary/20",
        secondary: "bg-secondary text-secondary-foreground border border-border",
        destructive: "bg-destructive/10 text-destructive border border-destructive/20",
        outline: "text-foreground border border-border",
        success: "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20",
        warning: "bg-amber-500/10 text-amber-800 border border-amber-500/20",
        accent: "bg-accent text-accent-foreground border border-accent-foreground/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
