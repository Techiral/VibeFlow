"use client";

import { useFormStatus } from "react-dom";
import { type ComponentProps } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = ComponentProps<typeof Button> & {
  pendingText?: string;
};

export function SubmitButton({ children, pendingText, className, variant, size, ...props }: Props) {
  const { pending, action } = useFormStatus();

  const isPending = pending && action === props.formAction;

  return (
    <Button {...props} type="submit" aria-disabled={pending} disabled={isPending}
        className={cn(buttonVariants({ variant, size, className }))}
        loading={isPending} // Pass loading state to Button
    >
      {isPending ? pendingText : children}
    </Button>
  );
}
