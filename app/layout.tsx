import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

// Production resolves to the primary domain; previews to their deploy URL.
const host =
  process.env.VERCEL_ENV === 'production'
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL
    : process.env.VERCEL_URL;
const defaultUrl = host ? `https://${host}` : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
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
