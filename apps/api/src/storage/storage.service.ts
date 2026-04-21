import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { extname } from "path";
import { randomUUID } from "crypto";

type Folder = "avatars" | "materials" | "pdfs";

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client | null;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly useS3: boolean;

  constructor(private readonly config: ConfigService) {
    const provider = this.config.get<string>("STORAGE_PROVIDER", "local");
    const region = this.config.get<string>("AWS_REGION");
    const bucket = this.config.get<string>("AWS_S3_BUCKET");
    const accessKeyId = this.config.get<string>("AWS_ACCESS_KEY_ID");
    const secretAccessKey = this.config.get<string>("AWS_SECRET_ACCESS_KEY");

    this.bucket = bucket || "";
    this.publicBaseUrl = this.config.get<string>(
      "AWS_S3_PUBLIC_BASE_URL",
      `https://${this.bucket}.s3.${region || "us-east-1"}.amazonaws.com`,
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

  private async upload(
    file: Express.Multer.File,
    folder: Folder,
  ): Promise<string> {
    if (!this.useS3) {
      // Local mode — file already written to disk by Multer
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
}
