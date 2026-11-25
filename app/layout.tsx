import type { Metadata, Viewport } from 'next';
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

// viewport-fit=cover lets the map's bottom sheet pad for the home indicator
// (env(safe-area-inset-bottom)). Zoom stays enabled.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
