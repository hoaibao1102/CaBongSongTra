import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  Boxes,
  ReceiptText,
  BadgeDollarSign,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { signOut } from "@/lib/p0a/actions";
import { adminNav } from "@/lib/p0a/catalog";

const icons = [
  LayoutDashboard,
  Package,
  Boxes,
  ReceiptText,
  BadgeDollarSign,
  ShieldCheck,
];

export function AdminShell({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile?: { display_name?: string | null; role?: string | null } | null;
}) {
  return (
    <div className="p0a-shell">
      <aside className="p0a-sidebar">
        <Link href="/" className="p0a-brand">
          Cá Bống Sông Trà
        </Link>
        <nav className="p0a-nav">
          {adminNav.map((item, index) => {
            const Icon = icons[index] ?? LayoutDashboard;
            return (
              <Link key={item.href} href={item.href}>
                <Icon size={17} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <form action={signOut} className="p0a-signout">
          <button type="submit">
            <LogOut size={16} /> Đăng xuất
          </button>
        </form>
      </aside>
      <main className="p0a-main">
        <header className="p0a-topbar">
          <span>Quản lý vận hành</span>
          <strong>
            {profile?.display_name ?? "Thiết lập cục bộ"} ·{" "}
            {profile?.role === "OWNER_ADMIN"
              ? "Chủ sở hữu / Quản trị viên"
              : profile?.role === "MEMBER"
                ? "Thành viên"
                : "Chưa cấu hình Supabase"}
          </strong>
        </header>
        {children}
      </main>
    </div>
  );
}

export function AdminCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="p0a-card">
      <div className="p0a-card-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="p0a-empty">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}
