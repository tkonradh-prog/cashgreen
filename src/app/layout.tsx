import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'CashFlow · Kontrola gotówki, wydatków i majątku',
  description:
    'Nowoczesna aplikacja do szybkiego rozliczania wydatków, kontroli stanu konta i gotówki oraz szczegółowej analityki finansów osobistych.',
  manifest: '/manifest.webmanifest',
  applicationName: 'CashFlow',
  appleWebApp: {
    capable: true,
    title: 'CashFlow',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#030407',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="pl"
      className={`${plusJakarta.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black text-white selection:bg-white/20 selection:text-white">
        {children}
      </body>
    </html>
  );
}
