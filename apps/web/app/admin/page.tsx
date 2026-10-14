import App from "../screens";
import { GET as getMedia } from "../api/media/route";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const media = await (await getMedia()).json();
  return <App initialView="admin" initialImages={media.images ?? {}} />;
}
