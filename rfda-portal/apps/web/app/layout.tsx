import type { Metadata } from 'next';
import { Public_Sans } from 'next/font/google';
import { Providers } from '@/components/ui';
import { THEME_SCRIPT } from '@/components/ThemeToggle';
import './globals.css';

const font = Public_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-public-sans' });

export const metadata: Metadata = {
  title: 'Rwanda FDA regulatory services portal',
  description: 'Apply, pay and follow every Rwanda FDA application in one place.',
  icons: { icon: '/logo.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme is set before first paint by THEME_SCRIPT (saved choice; light by default), so no dark flash.
    <html lang="en" className={font.variable} data-theme="light" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
