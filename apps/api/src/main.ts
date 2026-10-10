import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
async function bootstrap() { const app = await NestFactory.create(AppModule); app.setGlobalPrefix("api/v1"); app.use(helmet()); app.use(cookieParser()); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })); const swagger = new DocumentBuilder().setTitle("Cá Bống Sông Trà API").setVersion("2.0").addCookieAuth("cbst_session").build(); SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swagger)); await app.listen(Number(process.env.PORT ?? 4000)); }
void bootstrap();
