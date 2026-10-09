import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { site } from "@/data/site";
import { Analytics } from "@/components/analytics";
import { ZaloModalProvider } from "@/components/zalo-modal";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.siteUrl),
  title: "Cá Bống Sông Trà Quảng Ngãi | Đặc sản giao tại TP.HCM",
  description: site.description,
  openGraph: {
    title: "Cá Bống Sông Trà Quảng Ngãi | Đặc sản giao tại TP.HCM",
    description: site.description,
    type: "website",
    locale: "vi_VN",
    images: [{ url: "/images/bang-gia.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#232d25",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className={inter.className}>
        <ZaloModalProvider>
          {children}
          <Analytics />
        </ZaloModalProvider>
      </body>
    </html>
  );
}
