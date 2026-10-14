import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { HealthModule } from "./health/health.module";
import { CommerceModule } from "./v2/module";
@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env", "../../.env"] }), MongooseModule.forRootAsync({ inject: [ConfigService], useFactory: (config: ConfigService) => ({ uri: config.getOrThrow<string>("MONGODB_URI"), maxPoolSize: 10, serverSelectionTimeoutMS: 5000 }) }), HealthModule, CommerceModule] })
export class AppModule {}
