/** @format */

import * as React from "react"
import { cn } from "@/lib/utils"

export const Input = ({
  className,
  ref,
  webkitdirectory,
  ...props
}: React.ComponentPropsWithRef<"input"> & {
  directory?: "" | boolean
  webkitdirectory?: "true"
}) => {
  return (
    <input
      ref={ref}
      // @ts-expect-error - webkitdirectory is not a valid prop for input
      webkitdirectory={webkitdirectory}
      className={cn(
        "flex h-10 w-full rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10",
        className,
      )}
      {...props}
    />
  )
}
