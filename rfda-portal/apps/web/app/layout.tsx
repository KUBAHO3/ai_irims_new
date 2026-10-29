import type { Metadata } from 'next';
import { Public_Sans } from 'next/font/google';
import { Providers } from '@/components/ui';
import './globals.css';

const font = Public_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-public-sans' });

export const metadata: Metadata = {
  title: 'Rwanda FDA regulatory services portal',
  description: 'Apply, pay and follow every Rwanda FDA application in one place.',
  icons: { icon: '/logo.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={font.variable}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
