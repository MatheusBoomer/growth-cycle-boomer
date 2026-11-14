import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("esqueleto rounded-[10px] bg-muted/70", className)}
      {...props}
    />
  )
}

export { Skeleton }
