import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Enterprise Besu Network',
  description: 'Permissioned QBFT network dashboard and block explorer',
};

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/network', label: 'Network' },
  { href: '/blocks', label: 'Blocks' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/assets', label: 'Assets' },
  { href: '/token', label: 'Token' },
  { href: '/validators', label: 'Validators' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">
        <header className="border-b border-ink-200 bg-ink-950 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent-600" />
              <span className="text-sm font-semibold tracking-wide">Enterprise Besu Network</span>
            </Link>
            <span className="font-mono text-xs text-ink-200">QBFT · chain 7117</span>
          </div>
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="rounded px-3 py-1.5 text-sm text-ink-200 hover:bg-ink-900 hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
