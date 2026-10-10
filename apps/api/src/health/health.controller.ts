import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { HealthService } from "./health.service";
import { Public } from "../v2/http";
@ApiTags("health")
@Controller("health")
@Public()
export class HealthController { constructor(private readonly health: HealthService) {} @Get("live") live() { return this.health.live(); } }
