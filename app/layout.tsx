import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Claude Workflow Studio",
  description: "Design beautiful, valid Claude Code subagent and hook workflows locally.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
