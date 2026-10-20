import type { Metadata } from "next";
import "./globals.css";
import MainLayout from "@/components/MainLayout";
import { RoleProvider } from "@/contexts/RoleContext";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import { Toaster } from "sonner";
import AlertOverride from "@/components/AlertOverride";

export const metadata: Metadata = {
  title: "Dyummy Catering ERP",
  description: "ERP & CRM System untuk Dyummy Catering — Kelola leads, order, produksi, HR & payroll, dan keuangan dalam satu platform terintegrasi.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/icon-512.png",
  },
  openGraph: {
    title: "Dyummy Catering ERP",
    description: "Sistem Manajemen Catering Profesional & Terintegrasi (CRM, ERP, Produksi, HR & Payroll, Keuangan)",
    url: "https://erp-dyummycatering.vercel.app",
    siteName: "Dyummy Catering ERP",
    images: [
      {
        url: "/og-image.png",
        width: 512,
        height: 512,
        alt: "Dyummy Catering ERP Logo",
      },
    ],
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Dyummy Catering ERP",
    description: "ERP & CRM System untuk Dyummy Catering",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full font-sans">
        <SessionProviderWrapper>
          <RoleProvider>
            <MainLayout>{children}</MainLayout>
            <Toaster position="top-center" richColors closeButton />
            <AlertOverride />
          </RoleProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
