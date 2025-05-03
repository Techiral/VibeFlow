"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root // Export original Radix Root as Tooltip

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, children, ...props }, ref) => ( // Removed content prop, use children
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    >
      {children} {/* Render children */}
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

// Keep the custom component definition if needed elsewhere, but rename it
interface SimpleTooltipProps extends React.ComponentPropsWithoutRef<typeof Tooltip> {
  content?: React.ReactNode;
  children: React.ReactNode; // Trigger element
  side?: TooltipPrimitive.TooltipContentProps['side'];
  align?: TooltipPrimitive.TooltipContentProps['align'];
  sideOffset?: TooltipPrimitive.TooltipContentProps['sideOffset'];
  className?: string;
}

const SimpleTooltip: React.FC<SimpleTooltipProps> = ({
  content,
  children,
  side = 'top',
  align = 'center',
  sideOffset = 4,
  className,
  ...props
}) => {
   if (!content) {
     return <>{children}</>;
   }

  return (
    <Tooltip {...props}> {/* Use the original Tooltip (Radix Root) */}
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align} sideOffset={sideOffset} className={className}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
};


export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, SimpleTooltip }; // Export SimpleTooltip if needed, keep original Tooltip export
