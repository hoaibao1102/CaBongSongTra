import type { Metadata } from "next";
import "./styles.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Cá Bống Sông Trà",
  description: "Đặc sản Quảng Ngãi",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
