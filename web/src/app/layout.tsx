import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import dynamic from "next/dynamic";
import { SessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { TenantResolver } from "@/components/providers/tenant-resolver";

const ServiceWorkerRegistration = dynamic(
  () =>
    import(
      "@/components/providers/service-worker-registration"
    ).then((m) => ({ default: m.ServiceWorkerRegistration })),
  { ssr: false },
);

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "AutomotiveOS — ERP Taller",
  description: "Sistema ERP Cloud para talleres automotrices — Paraguay",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/assets/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/assets/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/assets/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/assets/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "AutoOS ERP",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <QueryProvider>
              <SessionProvider>
                <TenantResolver />
                <ServiceWorkerRegistration />
                {children}
              </SessionProvider>
            </QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
