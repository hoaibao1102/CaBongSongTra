import { sitemapEntries } from "../lib/public-content";
export default function sitemap() {
  return sitemapEntries(process.env.WEB_ORIGIN);
}
