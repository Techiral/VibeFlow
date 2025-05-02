"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    "aria-label"?: string; // Add aria-label prop
  }
>(({ className, value, "aria-label": ariaLabel, ...props }, ref) => ( // Destructure aria-label
  <ProgressPrimitive.Root
    ref={ref}
    aria-label={ariaLabel} // Assign aria-label
    aria-valuenow={value} // Add aria-valuenow for screen readers
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
