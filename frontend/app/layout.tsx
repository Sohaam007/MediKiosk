import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Providers from "@/components/Providers";
import Header from "@/components/Header";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "MediKiosk — AI Clinical Intake | Ministry of Ayush & AIIA",
  description:
    "AI-powered multilingual clinical intake kiosk for hospital outpatient departments (AIIA).",
};

export const viewport: Viewport = {
  width: "device-width",
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50 text-slate-900 min-h-screen flex flex-col`}
      >
        <Providers>
          <Header />
          <main className="flex-1 flex flex-col">{children}</main>
          <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-xs md:text-sm text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto w-full">
            <span>© All India Institute of Ayurveda (AIIA) • Ministry of Ayush</span>
            <span className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Kiosk Online • DPDP Act 2023 Compliant • ABDM Enabled
            </span>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
