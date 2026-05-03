import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join, resolve } from "path";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const cookieParser = require("cookie-parser");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const helmet = require("helmet");

async function bootstrap() {
  const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'log' : 'verbose');
  const validLevels = ["error", "warn", "log", "debug", "verbose"] as const;
  type LogLevel = (typeof validLevels)[number];
  const levelIndex = validLevels.indexOf(logLevel as LogLevel);
  const enabledLevels =
    levelIndex >= 0
      ? (validLevels.slice(0, levelIndex + 1) as unknown as LogLevel[])
      : (["error", "warn", "log", "debug", "verbose"] as LogLevel[]);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: enabledLevels,
  });

  app.use(helmet({
    contentSecurityPolicy: false,       // CSP managed by Next.js frontend
    crossOriginEmbedderPolicy: false,   // allow Swagger UI assets
    crossOriginResourcePolicy: false,   // allow cross-origin loading of uploads (avatars, materials)
  }));

  // Increase JSON body limit for AI chat (file content embedded in message)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const bodyParser = require('body-parser');
  app.use(bodyParser.json({ limit: '10mb' }));

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

  // Serve uploaded files (avatars, materials, ebooks)
  // Use process.cwd() so the path resolves correctly regardless of whether
  // the app is run via ts-node (src/) or compiled (dist/).
  // Both NestJS start modes run from the apps/api/ directory as CWD.
  const uploadsDir = resolve(process.cwd(), "uploads");
  const logger = new Logger("Bootstrap");
  logger.log(`Uploads dir: ${uploadsDir}`);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  app.getHttpAdapter().getInstance().use("/uploads", require("express").static(uploadsDir));

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
