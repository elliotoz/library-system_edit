import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash, randomUUID } from "crypto";
import { extname } from "path";
import * as path from "path";
import { Readable } from "stream";

type Folder = "avatars" | "materials" | "pdfs";
type S3Operation = "upload" | "download" | "delete";

type S3LogContext = {
  durationMs: number;
  fileSize?: number;
  mimeType?: string;
  requestId?: string;
};

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client | null;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly useS3: boolean;
  private readonly region: string;
  private readonly bucketAlias?: string;

  constructor(private readonly config: ConfigService) {
    const provider = this.config.get<string>("STORAGE_PROVIDER", "local");
    const region = this.config.get<string>("AWS_REGION", "").trim();
    const bucket = this.config.get<string>("AWS_S3_BUCKET", "").trim();
    const configuredBaseUrl = this.config.get<string>("AWS_S3_PUBLIC_BASE_URL", "").trim();

    this.bucket = bucket;
    this.region = region || "us-east-1";
    this.useS3 = provider === "s3";
    this.s3 = this.useS3 ? new S3Client({ region: this.region }) : null;
    this.publicBaseUrl =
      configuredBaseUrl ||
      (this.bucket
        ? `https://${this.bucket}.s3.${this.region}.amazonaws.com`
        : "");
    this.bucketAlias = this.bucket
      ? `bucket-${createHash("sha256").update(this.bucket).digest("hex").slice(0, 12)}`
      : undefined;
  }

  async uploadImage(file: Express.Multer.File, folder: Folder): Promise<string> {
    return this.upload(file, folder);
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: "materials" | "pdfs",
  ): Promise<string> {
    return this.upload(file, folder);
  }

  async getFileBuffer(fileUrl: string): Promise<Buffer> {
    if (this.isLocalUploadUrl(fileUrl)) {
      return this.readLocalUpload(fileUrl);
    }

    const s3Key = this.extractManagedS3Key(fileUrl);
    if (s3Key && this.s3) {
      const startedAt = Date.now();

      try {
        const response = await this.s3.send(
          new GetObjectCommand({
            Bucket: this.bucket,
            Key: s3Key,
          }),
        );

        if (!response.Body) {
          throw new Error("S3 object returned an empty body.");
        }

        const buffer = await this.bodyToBuffer(response.Body);
        this.logS3Success("download", {
          durationMs: Date.now() - startedAt,
          fileSize: buffer.length,
          mimeType: response.ContentType,
          requestId: response.$metadata.requestId,
        });
        return buffer;
      } catch (error) {
        this.logS3Failure("download", error, {
          durationMs: Date.now() - startedAt,
        });
        throw error;
      }
    }

    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
      const res = await fetch(fileUrl, {
        signal: AbortSignal.timeout(30_000),
        headers: { "User-Agent": "LibrarySystem-Documents/1.0" },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} fetching remote document.`);
      }
      return Buffer.from(await res.arrayBuffer());
    }

    throw new Error("Unsupported file URL.");
  }

  isLocalUploadUrl(fileUrl: string): boolean {
    return fileUrl.startsWith("/uploads/");
  }

  private async upload(file: Express.Multer.File, folder: Folder): Promise<string> {
    if (!this.useS3) {
      return `/uploads/${folder}/${file.filename}`;
    }

    const key = `${folder}/${randomUUID()}${extname(file.originalname)}`;
    const startedAt = Date.now();
    const body = file.buffer?.length ? file.buffer : await this.readFileFromDisk(file);

    try {
      await this.s3!.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: file.mimetype,
        }),
      );

      this.logS3Success("upload", {
        durationMs: Date.now() - startedAt,
        fileSize: body.length,
        mimeType: file.mimetype,
      });
      return `${this.publicBaseUrl}/${key}`;
    } catch (error) {
      this.logS3Failure("upload", error, {
        durationMs: Date.now() - startedAt,
        fileSize: body.length,
        mimeType: file.mimetype,
      });
      throw error;
    }
  }

  private async readFileFromDisk(file: Express.Multer.File): Promise<Buffer> {
    const fs = await import("fs/promises");
    return fs.readFile(file.path);
  }

  private async readLocalUpload(fileUrl: string): Promise<Buffer> {
    const fs = await import("fs/promises");
    return fs.readFile(this.resolveLocalUploadPath(fileUrl));
  }

  private resolveLocalUploadPath(fileUrl: string): string {
    const uploadsRoot = path.resolve(process.cwd(), "uploads");
    const resolved = path.resolve(process.cwd(), `.${fileUrl}`);

    if (resolved !== uploadsRoot && !resolved.startsWith(`${uploadsRoot}${path.sep}`)) {
      throw new Error("Blocked local upload path outside uploads directory.");
    }

    return resolved;
  }

  private extractManagedS3Key(fileUrl: string): string | null {
    if (!this.useS3 || !this.bucket) {
      return null;
    }

    try {
      const target = new URL(fileUrl);

      if (this.publicBaseUrl) {
        const configuredBase = new URL(this.publicBaseUrl);
        const configuredPrefix = configuredBase.pathname.replace(/\/$/, "");

        if (target.origin === configuredBase.origin) {
          const keyPath = target.pathname.startsWith(`${configuredPrefix}/`)
            ? target.pathname.slice(configuredPrefix.length + 1)
            : target.pathname.slice(1);
          return decodeURIComponent(keyPath);
        }
      }

      const virtualHosts = new Set([
        `${this.bucket}.s3.amazonaws.com`,
        `${this.bucket}.s3.${this.region}.amazonaws.com`,
      ]);

      if (virtualHosts.has(target.hostname)) {
        return decodeURIComponent(target.pathname.replace(/^\/+/, ""));
      }
    } catch {
      return null;
    }

    return null;
  }

  private async bodyToBuffer(body: unknown): Promise<Buffer> {
    if (body instanceof Uint8Array) {
      return Buffer.from(body);
    }

    if (
      body &&
      typeof body === "object" &&
      "transformToByteArray" in body &&
      typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray ===
        "function"
    ) {
      const bytes = await (body as {
        transformToByteArray: () => Promise<Uint8Array>;
      }).transformToByteArray();
      return Buffer.from(bytes);
    }

    if (body instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }

    throw new Error("Unsupported S3 response body type.");
  }

  private logS3Success(operation: S3Operation, context: S3LogContext): void {
    this.logger.log(
      JSON.stringify(
        this.compactLog({
          event: `storage.s3.${operation}.completed`,
          service: "library-api",
          storageProvider: "s3",
          regionConfigured: this.region.length > 0,
          bucketConfigured: this.bucket.length > 0,
          bucketAlias: this.bucketAlias,
          s3CredentialsConfigured: this.useS3,
          operation,
          fileSize: context.fileSize,
          mimeType: context.mimeType,
          requestId: context.requestId,
          durationMs: context.durationMs,
          result: "success",
        }),
      ),
    );
  }

  private logS3Failure(
    operation: S3Operation,
    error: unknown,
    context: S3LogContext,
  ): void {
    const err = error as {
      name?: string;
      code?: string;
      Code?: string;
      $metadata?: { httpStatusCode?: number; requestId?: string };
    };

    this.logger.error(
      JSON.stringify(
        this.compactLog({
          event: `storage.s3.${operation}.failed`,
          service: "library-api",
          storageProvider: "s3",
          regionConfigured: this.region.length > 0,
          bucketConfigured: this.bucket.length > 0,
          bucketAlias: this.bucketAlias,
          s3CredentialsConfigured: this.useS3,
          operation,
          errorName: err?.name ?? "Error",
          errorCode: err?.code ?? err?.Code,
          httpStatusCode: err?.$metadata?.httpStatusCode,
          requestId: context.requestId ?? err?.$metadata?.requestId,
          fileSize: context.fileSize,
          mimeType: context.mimeType,
          durationMs: context.durationMs,
          result: "failure",
        }),
      ),
    );
  }

  private compactLog<T extends Record<string, unknown>>(payload: T): T {
    return Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined),
    ) as T;
  }
}
