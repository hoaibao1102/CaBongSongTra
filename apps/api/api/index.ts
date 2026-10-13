import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import type { Request, Response } from "express";
import { AppModule } from "../src/app.module";

let server: ((req: Request, res: Response) => void) | null = null;

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
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  await app.init();
  return app.getHttpAdapter().getInstance();
}

export default async function handler(req: Request, res: Response) {
  const app = server ?? (server = await bootstrap());
  app(req, res);
}
