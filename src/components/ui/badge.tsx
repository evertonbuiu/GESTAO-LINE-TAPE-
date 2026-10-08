import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Status variants
        available:
          "border-transparent bg-[hsl(var(--status-available))] text-[hsl(var(--status-available-foreground))] hover:bg-[hsl(var(--status-available))]/80",
        pending:
          "border-transparent bg-[hsl(var(--status-pending))] text-[hsl(var(--status-pending-foreground))] hover:bg-[hsl(var(--status-pending))]/80",
        confirmed:
          "border-transparent bg-[hsl(var(--status-confirmed))] text-[hsl(var(--status-confirmed-foreground))] hover:bg-[hsl(var(--status-confirmed))]/80",
        allocated:
          "border-transparent bg-[hsl(var(--status-allocated))] text-[hsl(var(--status-allocated-foreground))] hover:bg-[hsl(var(--status-allocated))]/80",
        returned:
          "border-transparent bg-[hsl(var(--status-returned))] text-[hsl(var(--status-returned-foreground))] hover:bg-[hsl(var(--status-returned))]/80",
        maintenance:
          "border-transparent bg-[hsl(var(--status-maintenance))] text-[hsl(var(--status-maintenance-foreground))] hover:bg-[hsl(var(--status-maintenance))]/80",
        "out-of-stock":
          "border-transparent bg-[hsl(var(--status-out-of-stock))] text-[hsl(var(--status-out-of-stock-foreground))] hover:bg-[hsl(var(--status-out-of-stock))]/80",
        "low-stock":
          "border-transparent bg-[hsl(var(--status-low-stock))] text-[hsl(var(--status-low-stock-foreground))] hover:bg-[hsl(var(--status-low-stock))]/80",
        active:
          "border-transparent bg-[hsl(var(--status-active))] text-[hsl(var(--status-active-foreground))] hover:bg-[hsl(var(--status-active))]/80",
        inactive:
          "border-transparent bg-[hsl(var(--status-inactive))] text-[hsl(var(--status-inactive-foreground))] hover:bg-[hsl(var(--status-inactive))]/80",
        scheduled:
          "border-transparent bg-[hsl(var(--status-scheduled))] text-[hsl(var(--status-scheduled-foreground))] hover:bg-[hsl(var(--status-scheduled))]/80",
        "in-progress":
          "border-transparent bg-[hsl(var(--status-in-progress))] text-[hsl(var(--status-in-progress-foreground))] hover:bg-[hsl(var(--status-in-progress))]/80",
        completed:
          "border-transparent bg-[hsl(var(--status-completed))] text-[hsl(var(--status-completed-foreground))] hover:bg-[hsl(var(--status-completed))]/80",
        cancelled:
          "border-transparent bg-[hsl(var(--status-cancelled))] text-[hsl(var(--status-cancelled-foreground))] hover:bg-[hsl(var(--status-cancelled))]/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
