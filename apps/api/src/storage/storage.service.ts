import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { extname } from "path";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import * as path from "path";

type Folder = "avatars" | "materials" | "pdfs";

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client | null;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly useS3: boolean;
  private readonly region: string;

  constructor(private readonly config: ConfigService) {
    const provider = this.config.get<string>("STORAGE_PROVIDER", "local");
    const region = this.config.get<string>("AWS_REGION");
    const bucket = this.config.get<string>("AWS_S3_BUCKET");
    const accessKeyId = this.config.get<string>("AWS_ACCESS_KEY_ID");
    const secretAccessKey = this.config.get<string>("AWS_SECRET_ACCESS_KEY");

    this.bucket = bucket || "";
    this.region = region || "us-east-1";
    this.publicBaseUrl = this.config.get<string>(
      "AWS_S3_PUBLIC_BASE_URL",
      `https://${this.bucket}.s3.${this.region}.amazonaws.com`,
    );

    if (
      provider === "s3" &&
      region &&
      bucket &&
      accessKeyId &&
      secretAccessKey
    ) {
      this.s3 = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.useS3 = true;
      this.logger.log("Storage provider: AWS S3");
    } else {
      this.s3 = null;
      this.useS3 = false;
      this.logger.log("Storage provider: local disk");
    }
  }

  /**
   * Upload an image file (avatars, material covers).
   * Returns the public URL.
   */
  async uploadImage(
    file: Express.Multer.File,
    folder: Folder,
  ): Promise<string> {
    return this.upload(file, folder);
  }

  /**
   * Upload a document/media file (materials, pdfs).
   * Returns the public URL.
   */
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
      const response = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
        }),
      );

      if (!response.Body) {
        throw new Error(`S3 object ${s3Key} returned an empty body`);
      }

      return this.bodyToBuffer(response.Body);
    }

    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
      const res = await fetch(fileUrl, {
        signal: AbortSignal.timeout(30_000),
        headers: { "User-Agent": "LibrarySystem-Documents/1.0" },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} fetching ${fileUrl}`);
      }
      return Buffer.from(await res.arrayBuffer());
    }

    throw new Error(`Unsupported file URL: ${fileUrl}`);
  }

  isLocalUploadUrl(fileUrl: string): boolean {
    return fileUrl.startsWith("/uploads/");
  }

  private async upload(
    file: Express.Multer.File,
    folder: Folder,
  ): Promise<string> {
    if (!this.useS3) {
      return `/uploads/${folder}/${file.filename}`;
    }

    const key = `${folder}/${randomUUID()}${extname(file.originalname)}`;

    await this.s3!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer || await this.readFileFromDisk(file),
        ContentType: file.mimetype,
      }),
    );

    this.logger.debug(`Uploaded to S3: ${key}`);
    return `${this.publicBaseUrl}/${key}`;
  }

  /**
   * When Multer uses diskStorage, file.buffer is empty.
   * Read from the temp path Multer wrote to.
   */
  private async readFileFromDisk(
    file: Express.Multer.File,
  ): Promise<Buffer> {
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

    if (
      resolved !== uploadsRoot &&
      !resolved.startsWith(`${uploadsRoot}${path.sep}`)
    ) {
      throw new Error(`Blocked local upload path outside uploads directory: ${fileUrl}`);
    }

    return resolved;
  }

  private extractManagedS3Key(fileUrl: string): string | null {
    if (!this.useS3) {
      return null;
    }

    try {
      const target = new URL(fileUrl);
      const configuredBase = new URL(this.publicBaseUrl);
      const configuredPrefix = configuredBase.pathname.replace(/\/$/, "");

      if (target.origin === configuredBase.origin) {
        const keyPath = target.pathname.startsWith(`${configuredPrefix}/`)
          ? target.pathname.slice(configuredPrefix.length + 1)
          : target.pathname.slice(1);
        return decodeURIComponent(keyPath);
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
      typeof (body as { transformToByteArray?: () => Promise<Uint8Array> })
        .transformToByteArray === "function"
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

    throw new Error("Unsupported S3 response body type");
  }
}
