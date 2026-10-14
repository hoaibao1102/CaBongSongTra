import { notFound } from "next/navigation";
import App from "../../screens";
import { adminSections } from "../../../lib/navigation";

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!adminSections.some((value) => value === section)) notFound();
  return <App initialView="admin" initialAdminSection={section} />;
}
