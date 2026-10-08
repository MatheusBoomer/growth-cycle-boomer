"use client"

import * as React from "react"
import { Collapsible } from "@base-ui/react/collapsible"
import { BrainIcon, ChevronDownIcon, DotIcon, type LucideIcon } from "lucide-react"
import { cn } from "cn"

type StatusPasso = "complete" | "active" | "pending"

function ChainOfThought({ className, ...props }: React.ComponentProps<typeof Collapsible.Root>) {
  return <Collapsible.Root data-slot="chain-of-thought" className={cn("w-full min-w-0", className)} {...props} />
}

function ChainOfThoughtHeader({
  className,
  children,
  icon: Icone = BrainIcon,
  ...props
}: React.ComponentProps<typeof Collapsible.Trigger> & { icon?: LucideIcon }) {
  return (
    <Collapsible.Trigger
      data-slot="chain-of-thought-header"
      className={cn(
        "group/cot flex w-full cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors select-none hover:text-foreground",
        className,
      )}
      {...props}
    >
      <Icone className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
      <ChevronDownIcon className="size-3.5 shrink-0 transition-transform group-data-[panel-open]/cot:rotate-180" />
    </Collapsible.Trigger>
  )
}

function ChainOfThoughtContent({ className, ...props }: React.ComponentProps<typeof Collapsible.Panel>) {
  return <Collapsible.Panel data-slot="chain-of-thought-content" className={cn("mt-2 flex flex-col", className)} {...props} />
}

function ChainOfThoughtStep({
  className,
  icon: Icone = DotIcon,
  label,
  description,
  status = "complete",
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  icon?: LucideIcon
  label: React.ReactNode
  description?: React.ReactNode
  status?: StatusPasso
  children?: React.ReactNode
}) {
  return (
    <div
      data-slot="chain-of-thought-step"
      data-status={status}
      className={cn(
        "group/passo flex gap-2 text-xs",
        status === "complete" && "text-muted-foreground",
        status === "active" && "text-foreground",
        status === "pending" && "text-muted-foreground/50",
        className,
      )}
      {...props}
    >
      <div className="relative flex flex-col items-center self-stretch">
        <Icone className={cn("mt-0.5 size-3.5 shrink-0", status === "active" && "animate-pulse")} />
        <div className="w-px flex-1 bg-border group-last/passo:hidden" />
      </div>
      <div className="min-w-0 flex-1 pb-2.5">
        <div className={cn("min-w-0", status === "active" && "shimmer")}>{label}</div>
        {description && <div className="mt-1 text-muted-foreground">{description}</div>}
        {children}
      </div>
    </div>
  )
}

export { ChainOfThought, ChainOfThoughtHeader, ChainOfThoughtContent, ChainOfThoughtStep, type StatusPasso }
