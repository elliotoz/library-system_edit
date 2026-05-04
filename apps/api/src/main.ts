import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ConfigService } from "@nestjs/config";
import { S3Client } from "@aws-sdk/client-s3";
import { resolve } from "path";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const cookieParser = require("cookie-parser");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const helmet = require("helmet");

const MIN_JWT_SECRET_LENGTH = 32;

type StartupConfigLog = {
  event: "app.config.loaded";
  service: "library-api";
  nodeEnv: string;
  port: number;
  databaseConfigured: boolean;
  jwtSecretConfigured: boolean;
  jwtSecretLengthValid: boolean;
  corsOrigin: string;
  storageProvider: string;
  s3Enabled: boolean;
  awsRegionConfigured: boolean;
  s3BucketConfigured: boolean;
  awsCredentialsDetected: boolean;
};

function getEnabledLogLevels() {
  const logLevel =
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === "production" ? "log" : "verbose");
  const validLevels = ["error", "warn", "log", "debug", "verbose"] as const;
  type LogLevel = (typeof validLevels)[number];
  const levelIndex = validLevels.indexOf(logLevel as LogLevel);

  return levelIndex >= 0
    ? (validLevels.slice(0, levelIndex + 1) as unknown as LogLevel[])
    : (["error", "warn", "log", "debug", "verbose"] as LogLevel[]);
}

function parseCorsOrigins(rawValue: string): string[] {
  return rawValue
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function detectAwsCredentials(region: string): Promise<boolean> {
  const client = new S3Client({ region });
  const credentialsProvider = client.config.credentials;

  if (typeof credentialsProvider !== "function") {
    return false;
  }

  const credentials = await credentialsProvider();
  return Boolean(credentials?.accessKeyId && credentials?.secretAccessKey);
}

async function validateStartupConfig(
  config: ConfigService,
): Promise<StartupConfigLog> {
  const jwtSecret = config.get<string>("JWT_SECRET", "").trim();
  const jwtSecretConfigured = jwtSecret.length > 0;
  const jwtSecretLengthValid = jwtSecret.length >= MIN_JWT_SECRET_LENGTH;

  if (!jwtSecretConfigured || !jwtSecretLengthValid) {
    throw new Error(
      `JWT_SECRET must be configured and at least ${MIN_JWT_SECRET_LENGTH} characters long.`,
    );
  }

  const nodeEnv = config.get<string>("NODE_ENV", "development");
  const port = parseInt(config.get<string>("PORT", "3001"), 10);
  const corsOrigin = config.get<string>("CORS_ORIGIN", "http://localhost:3000");
  const storageProvider = config.get<string>("STORAGE_PROVIDER", "local");
  const s3Enabled = storageProvider === "s3";
  const awsRegion = config.get<string>("AWS_REGION", "").trim();
  const s3Bucket = config.get<string>("AWS_S3_BUCKET", "").trim();
  const awsRegionConfigured = awsRegion.length > 0;
  const s3BucketConfigured = s3Bucket.length > 0;
  let awsCredentialsDetected = false;

  if (s3Enabled) {
    if (!awsRegionConfigured) {
      throw new Error("AWS_REGION must be configured when STORAGE_PROVIDER=s3.");
    }

    if (!s3BucketConfigured) {
      throw new Error("AWS_S3_BUCKET must be configured when STORAGE_PROVIDER=s3.");
    }

    try {
      awsCredentialsDetected = await detectAwsCredentials(awsRegion);
    } catch {
      awsCredentialsDetected = false;
    }

    if (!awsCredentialsDetected) {
      throw new Error(
        "AWS credentials could not be resolved via the AWS SDK credential chain.",
      );
    }
  }

  return {
    event: "app.config.loaded",
    service: "library-api",
    nodeEnv,
    port,
    databaseConfigured: true,
    jwtSecretConfigured,
    jwtSecretLengthValid,
    corsOrigin,
    storageProvider,
    s3Enabled,
    awsRegionConfigured,
    s3BucketConfigured,
    awsCredentialsDetected,
  };
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: getEnabledLogLevels(),
  });

  const logger = new Logger("Bootstrap");
  const configService = app.get(ConfigService);
  let startupConfig: StartupConfigLog;

  try {
    startupConfig = await validateStartupConfig(configService);
  } catch (error) {
    await app.close();
    throw error;
  }

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: false,
    }),
  );

  // Increase JSON body limit for AI chat (file content embedded in message)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const bodyParser = require("body-parser");
  app.use(bodyParser.json({ limit: "10mb" }));

  app.use(cookieParser());

  const corsOrigins = parseCorsOrigins(startupConfig.corsOrigin);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const uploadsDir = resolve(process.cwd(), "uploads");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  app.getHttpAdapter().getInstance().use("/uploads", require("express").static(uploadsDir));

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("Library System API")
    .setDescription(
      "AI-Integrated University Library System - Üsküdar University",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .addTag("auth", "Authentication endpoints")
    .addTag("users", "User management endpoints")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  await app.listen(startupConfig.port);

  logger.log(JSON.stringify(startupConfig));
  logger.log(
    JSON.stringify({
      event: "app.started",
      service: "library-api",
      nodeEnv: startupConfig.nodeEnv,
      port: startupConfig.port,
      docsPath: "/api/docs",
    }),
  );
}

bootstrap();
