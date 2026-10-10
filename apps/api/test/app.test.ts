import { describe, expect, it } from "vitest";
import { HealthService } from "../src/health/health.service";
import { ProductsService } from "../src/products/products.service";

describe("health",()=>{it("returns a non-secret liveness response",()=>{expect(new HealthService().live()).toEqual({status:"ok",service:"cbst-api"});});});
describe("catalog",()=>{it("exposes only the approved public SKUs and prices",()=>{expect(new ProductsService().listPublic()).toEqual([{sku:"CBST-300",name:"Cá bống Sông Trà 300g",netWeightG:300,priceVnd:109000},{sku:"CBST-400",name:"Cá bống Sông Trà 400g",netWeightG:400,priceVnd:139000},{sku:"CBST-600",name:"Cá bống Sông Trà 600g",netWeightG:600,priceVnd:199000}]);});});
