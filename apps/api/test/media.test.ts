import { describe, expect, it } from "vitest";
import { mediaAssetSchema, mediaSlotSchema } from "../src/v2/models";
import { CommerceController } from "../src/v2/controller";

describe("Media Schema Definitions", () => {
  it("mediaAssetSchema has expected paths", () => {
    expect(mediaAssetSchema.path("id")).toBeDefined();
    expect(mediaAssetSchema.path("url")).toBeDefined();
    expect(mediaAssetSchema.path("title")).toBeDefined();
    expect(mediaAssetSchema.path("tag")).toBeDefined();
    expect(mediaAssetSchema.path("publicId")).toBeDefined();
    expect(mediaAssetSchema.path("createdAt")).toBeDefined();
    expect(mediaAssetSchema.path("updatedAt")).toBeDefined();
  });

  it("mediaSlotSchema has expected paths", () => {
    expect(mediaSlotSchema.path("slotKey")).toBeDefined();
    expect(mediaSlotSchema.path("url")).toBeDefined();
    expect(mediaSlotSchema.path("mediaAssetId")).toBeDefined();
    expect(mediaSlotSchema.path("updatedAt")).toBeDefined();
  });
});

describe("Media endpoint authorization", () => {
  it.each(["createMediaAsset", "assignMediaSlot", "bulkSyncMedia", "deleteMediaAsset"] as const)(
    "%s is owner-only and not public",
    (method) => {
      const handler = CommerceController.prototype[method];
      expect(Reflect.getMetadata("owner", handler)).toBe(true);
      expect(Reflect.getMetadata("public", handler)).not.toBe(true);
    },
  );
});
