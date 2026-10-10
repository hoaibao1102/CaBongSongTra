import type { Metadata } from "next";
import "./styles.css";
export const metadata: Metadata = { title: "Cá Bống Sông Trà", description: "Đặc sản Quảng Ngãi" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="vi"><body>{children}</body></html>; }
