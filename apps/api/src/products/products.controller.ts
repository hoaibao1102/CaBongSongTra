import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ProductsService } from "./products.service";
@ApiTags("products")
@Controller("products")
export class ProductsController { constructor(private readonly products: ProductsService) {} @Get() list() { return { data: this.products.listPublic() }; } }
