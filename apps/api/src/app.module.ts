import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { HealthModule } from "./health/health.module";
import { ProductsModule } from "./products/products.module";
@Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), MongooseModule.forRootAsync({ inject: [ConfigService], useFactory: (config: ConfigService) => ({ uri: config.getOrThrow<string>("MONGODB_URI"), maxPoolSize: 10, serverSelectionTimeoutMS: 5000 }) }), HealthModule, ProductsModule] })
export class AppModule {}
