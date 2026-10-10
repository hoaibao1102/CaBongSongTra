import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../auth/auth.service";
import { MongoRepository } from "./repository";
import { CommerceService } from "./service";
import { CommerceController } from "./controller";
import { ApiErrorFilter, ApiGuard } from "./http";
import { PasswordResetService } from "./password-reset";
@Module({ controllers: [CommerceController], providers: [MongoRepository, CommerceService, PasswordResetService,
  { provide: AuthService, inject: [MongoRepository, ConfigService], useFactory: (db: MongoRepository, config: ConfigService) => new AuthService(db, config.getOrThrow<string>("SESSION_SECRET")) },
  { provide: APP_GUARD, useClass: ApiGuard }, { provide: APP_FILTER, useClass: ApiErrorFilter },
] })
export class CommerceModule {}
