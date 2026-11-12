import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { SITE_URL } from '@/lib/site-url';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Cleveland Food System Map',
    template: '%s · Cleveland Food System Map',
  },
  description:
    'Community gardens, urban farms, and farmers markets across Cleveland.',
};

const geistSans = Geist({
  variable: '--font-geist-sans',
  display: 'swap',
  subsets: ['latin'],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.className} antialiased`}>{children}</body>
    </html>
  );
}
