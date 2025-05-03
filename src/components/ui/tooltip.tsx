"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const TooltipRoot = TooltipPrimitive.Root // Rename original Tooltip to avoid conflict

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & { content?: React.ReactNode } // Allow ReactNode content
>(({ className, sideOffset = 4, content, children, ...props }, ref) => (
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
      {content || children} {/* Render content prop if provided, otherwise children */}
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

// Custom Tooltip component that accepts content prop directly
interface CustomTooltipProps extends React.ComponentPropsWithoutRef<typeof TooltipRoot> { // Use TooltipRoot
  content?: React.ReactNode;
  children: React.ReactNode; // Trigger element
  side?: TooltipPrimitive.TooltipContentProps['side'];
  align?: TooltipPrimitive.TooltipContentProps['align'];
  sideOffset?: TooltipPrimitive.TooltipContentProps['sideOffset'];
  className?: string; // Allow classname for TooltipContent
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  content,
  children,
  side = 'top',
  align = 'center',
  sideOffset = 4,
  className, // Pass className to TooltipContent
  ...props // Pass remaining props to Tooltip root
}) => {
   if (!content) {
     // If no content is provided, just render the children (trigger) without a tooltip
     return <>{children}</>;
   }

  return (
    <TooltipRoot {...props}> {/* Use TooltipRoot */}
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align} sideOffset={sideOffset} className={className}>
        {content}
      </TooltipContent>
    </TooltipRoot>
  );
};


export { TooltipTrigger, TooltipContent, TooltipProvider, CustomTooltip as Tooltip }; // Remove direct Tooltip export, keep re-export
