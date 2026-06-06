import type { Metadata } from "next";
import "./globals.css";
import MainLayout from "@/components/MainLayout";
import { RoleProvider } from "@/contexts/RoleContext";

import SessionProviderWrapper from "@/components/SessionProviderWrapper";

export const metadata: Metadata = {
  title: "Dyummy Catering ERP",
  description: "ERP & CRM System untuk Dyummy Catering — Kelola leads, order, produksi, dan keuangan dalam satu platform.",
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
          </RoleProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
