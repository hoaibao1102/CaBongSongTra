import { describe, expect, it } from "vitest";
import { publicContent, sitemapEntries } from "./public-content";
describe("public information", () => {
  it("provides bilingual privacy, terms, contact and label safety without invented identity", () => {
    for (const key of ["privacy", "terms", "contact", "label-safety"])
      for (const lang of ["vi", "en"] as const)
        expect(publicContent[key][lang].body.length).toBeGreaterThan(80);
    expect(publicContent.contact.en.body).toContain("not yet verified");
    expect(publicContent.terms.en.body).toContain("not legal approval");
    expect(publicContent["label-safety"].en.body).toContain("allergen");
  });
  it("only emits sitemap URLs for a configured canonical origin", () => {
    expect(sitemapEntries(undefined)).toEqual([]);
    expect(sitemapEntries("https://shop.example/path")).toEqual([]);
    expect(sitemapEntries("https://shop.example").map((x) => x.url)).toContain(
      "https://shop.example/products/CBST-300",
    );
  });
});
