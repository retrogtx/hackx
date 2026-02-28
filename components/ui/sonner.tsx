"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      style={
        {
          "--normal-bg": "#0a0a0a",
          "--normal-text": "#ededed",
          "--normal-border": "#262626",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
