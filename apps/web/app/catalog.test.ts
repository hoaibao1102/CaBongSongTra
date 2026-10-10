import { describe, expect, it } from "vitest";
import { catalog } from "./catalog";
describe("public catalog",()=>{it("contains the approved bilingual SKUs",()=>{expect(catalog.map(x=>x.sku)).toEqual(["CBST-300","CBST-400","CBST-600"]);expect(catalog.every(x=>x.name.vi&&x.name.en)).toBe(true);});});
