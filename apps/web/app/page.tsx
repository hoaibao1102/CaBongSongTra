import fs from "fs";
import path from "path";
import App from "./screens";

export const dynamic = "force-dynamic";

function getInitialImages(): Record<string, string> {
  try {
    const file = path.join(process.cwd(), "public", "data", "media-settings.json");
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, "utf-8"));
      return data?.images || {};
    }
  } catch {
    /* ignore */
  }
  return {};
}

export default function Home() {
  const images = getInitialImages();
  return <App initialImages={images} />;
}
