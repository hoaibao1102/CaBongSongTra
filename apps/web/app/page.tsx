import App from "./screens";
import { GET as getMedia } from "./api/media/route";

export const dynamic = "force-dynamic";

export default async function Home() {
  const media = await (await getMedia()).json();
  return <App initialImages={media.images ?? {}} />;
}
