import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const cookieParser = require("cookie-parser");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const helmet = require("helmet");

async function bootstrap() {
  const logLevel = process.env.LOG_LEVEL || "log";
  const validLevels = ["error", "warn", "log", "debug", "verbose"] as const;
  type LogLevel = (typeof validLevels)[number];
  const levelIndex = validLevels.indexOf(logLevel as LogLevel);
  const enabledLevels =
    levelIndex >= 0
      ? (validLevels.slice(0, levelIndex + 1) as unknown as LogLevel[])
      : (["error", "warn", "log"] as LogLevel[]);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: enabledLevels,
  });

  app.use(helmet({
    contentSecurityPolicy: false, // CSP managed by Next.js frontend
    crossOriginEmbedderPolicy: false, // allow Swagger UI assets
  }));

  app.use(cookieParser());

  // Enable CORS for frontend — env-driven allowlist
  const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Serve uploaded files (ebooks, research materials, covers)
  app.useStaticAssets(join(__dirname, "..", "uploads"), {
    prefix: "/uploads/",
  });

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle("Library System API")
    .setDescription(
      "AI-Integrated University Library System - Üsküdar University"
    )
    .setVersion("1.0")
    .addBearerAuth()
    .addTag("auth", "Authentication endpoints")
    .addTag("users", "User management endpoints")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  // Start server
  const port = process.env.PORT || 3001;
  await app.listen(port);

  const logger = new Logger("Bootstrap");
  logger.log(
    `Server: http://localhost:${port} | Docs: http://localhost:${port}/api/docs`,
  );

  // Log auth/mail configuration status
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (googleClientId && googleClientSecret) {
    logger.log("Google OAuth: ENABLED");
  } else {
    logger.warn(
      "Google OAuth: DISABLED (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable)"
    );
  }

  const frontendUrl =
    process.env.FRONTEND_URL ||
    (process.env.CORS_ORIGIN || "http://localhost:3000").split(",")[0].trim();
  logger.log(`Frontend URL: ${frontendUrl}`);
}

bootstrap();
