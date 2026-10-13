import { Injectable } from "@nestjs/common";
@Injectable()
export class HealthService { live() { return { status: "ok", service: "cbst-api" }; } }
