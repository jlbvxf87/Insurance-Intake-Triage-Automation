import type { Metadata } from 'next'
// Self-hosted via the `geist` package rather than next/font/google: the build
// must not depend on reaching fonts.googleapis.com, and self-hosting removes a
// third-party request from every page load.
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  title: 'Insurance Intake & Triage Automation',
  description:
    'An AI-enabled insurance workflow that turns incoming submissions and policy documents into structured, validated, routed records.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
