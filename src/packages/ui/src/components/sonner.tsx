"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <span className="grid size-[26px] place-items-center rounded-[9px] bg-sucesso-fundo text-sucesso">
            <CircleCheckIcon className="size-3.5" />
          </span>
        ),
        info: (
          <span className="grid size-[26px] place-items-center rounded-[9px] bg-selo-sonnet-fundo text-selo-sonnet">
            <InfoIcon className="size-3.5" />
          </span>
        ),
        warning: (
          <span className="grid size-[26px] place-items-center rounded-[9px] bg-aviso-fundo text-aviso">
            <TriangleAlertIcon className="size-3.5" />
          </span>
        ),
        error: (
          <span className="grid size-[26px] place-items-center rounded-[9px] bg-perigo-fundo text-destructive">
            <OctagonXIcon className="size-3.5" />
          </span>
        ),
        loading: (
          <span className="grid size-[26px] place-items-center rounded-[9px] bg-muted text-muted-foreground">
            <Loader2Icon className="size-3.5 animate-spin" />
          </span>
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "16px",
          "--width": "340px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast gap-3! px-3.5! py-3! shadow-(--sombra-card)! [&_[data-icon]]:size-auto! [&_[data-icon]]:self-start! [&_[data-title]]:font-medium! [&_[data-description]]:text-muted-foreground!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
