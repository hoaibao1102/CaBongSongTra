import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  app.use(helmet());
  app.use(cookieParser());
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  if (!allowedOrigins.includes("https://ca-bong-song-tra.vercel.app")) {
    allowedOrigins.push("https://ca-bong-song-tra.vercel.app");
  }
  app.enableCors({ origin: allowedOrigins, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true, transform: true, transformOptions: { enableImplicitConversion: false } }));
  if (process.env.NODE_ENV !== "production") {
    const swagger = new DocumentBuilder().setTitle("Cá Bống Sông Trà API").setVersion("2.0").addCookieAuth("cbst_session").build();
    SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swagger));
  }
  await app.listen(Number(process.env.PORT ?? 4000));
}
void bootstrap();
