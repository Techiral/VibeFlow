import * as React from "react"

import { cn } from "@/lib/utils"

// Add id and name to the interface
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id?: string;
  name?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, id, name, ...props }, ref) => { // Destructure id and name
    return (
      <input
        type={type}
        id={id} // Assign id
        name={name} // Assign name
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", // Use bg-transparent, inherit from parent
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
