import type { Metadata, Viewport } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import WhitelabelMetadata from "./components/WhitelabelMetadata";
import AnalyticsWrapper from './components/AnalyticsWrapper';
import { Suspense } from "react";
import Link from "next/link";

const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-noto-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "WattWert Schnellaufmaß",
  description: "Aufmass- und Angeboterstellung für Fassaden",
  icons: {
    icon: '/wattwert.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={notoSans.className}>
        <AuthProvider>
          <Suspense>
            <AnalyticsWrapper />
            {/* Footer Links */}
            <div style={{
              position: 'fixed',
              bottom: '8px',
              right: '20px',
              display: 'flex',
              gap: '15px',
              zIndex: 1000,
              fontSize: '14px'
            }}>
              <Link href="/datenschutz" style={{ color: 'var(--fontcolor-light)', textDecoration: 'underline' }}>
                Datenschutz
              </Link>
              <Link href="/impressum" style={{ color: 'var(--fontcolor-light)', textDecoration: 'underline' }}>
                Impressum
              </Link>
            </div>
            <WhitelabelMetadata />
            {children}
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
