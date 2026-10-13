import { Injectable } from "@nestjs/common";
const products = [
 { sku: "CBST-300", name: "Cá bống Sông Trà 300g", netWeightG: 300, priceVnd: 109000 },
 { sku: "CBST-400", name: "Cá bống Sông Trà 400g", netWeightG: 400, priceVnd: 139000 },
 { sku: "CBST-600", name: "Cá bống Sông Trà 600g", netWeightG: 600, priceVnd: 199000 },
] as const;
@Injectable()
export class ProductsService { listPublic() { return products.map((product) => ({ ...product })); } }
