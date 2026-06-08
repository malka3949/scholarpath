import type { ReactNode } from 'react';
import { Heebo } from 'next/font/google';
import { Navbar } from '@/components/Navbar';
import { Providers } from '@/components/Providers';
import './globals.css';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
  display: 'swap',
});

export const metadata = {
  title: 'ScholarPath',
  description: 'פלטפורמה לגילוי מלגות ומעקב בקשות',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="min-h-screen">
        <Providers>
          <Navbar />
          <main className="sp-container py-8 lg:py-12">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
