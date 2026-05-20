import type { Metadata } from 'next'

import Providers from '@/app/providers'

import './globals.css'

export const metadata: Metadata = {
  title: 'QAForge — AI-Native Software Quality Infrastructure',
  description: 'Autonomous code audits, behavioral validation, and runtime probe execution.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;1,400&family=Geist:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
