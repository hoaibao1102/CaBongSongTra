import "../admin/styles.css";
import { signInWithPassword } from "@/lib/p0a/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  return <main className="p0a-login"><form action={signInWithPassword}><h1>Đăng nhập quản trị</h1><p>Tài khoản nội bộ do Admin mời; không mở đăng ký công khai.</p>{query.error ? <p role="alert">Email hoặc mật khẩu không đúng.</p> : null}<label>Email<input name="email" type="email" required /></label><label>Mật khẩu<input name="password" type="password" required /></label><button className="p0a-button" type="submit">Đăng nhập</button></form></main>;
}
