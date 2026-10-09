import "./styles.css";
import { redirect } from "next/navigation";
import { AdminShell } from "../admin-shell";
import { getCurrentProfile, hasSupabaseEnv } from "@/lib/p0a/supabase-server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!hasSupabaseEnv()) redirect("/setup-required");
  if (!profile) redirect("/login");
  return <AdminShell profile={profile}>{children}</AdminShell>;
}
