import { Injectable } from "@nestjs/common";
import * as mammoth from "mammoth";
import * as path from "path";
import { StorageService } from "./storage.service";

interface PdfParseTextResult {
  text: string;
  numpages?: number;
}

type PdfParseFunction = (buffer: Buffer) => Promise<PdfParseTextResult>;

let pdfParseFn: PdfParseFunction | null = null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WordExtractor = require("word-extractor");

function ensurePdfRuntimePolyfills(): void {
  const globalScope = globalThis as typeof globalThis & {
    DOMMatrix?: typeof DOMMatrix;
    ImageData?: typeof ImageData;
    Path2D?: typeof Path2D;
  };
  const processWithBuiltinModule = process as NodeJS.Process & {
    getBuiltinModule?: (name: string) => unknown;
  };

  if (typeof processWithBuiltinModule.getBuiltinModule !== "function") {
    processWithBuiltinModule.getBuiltinModule = (name: string) =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require(name);
  }

  if (!globalScope.DOMMatrix) {
    class MinimalDOMMatrix {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;
      m11 = 1;
      m12 = 0;
      m13 = 0;
      m14 = 0;
      m21 = 0;
      m22 = 1;
      m23 = 0;
      m24 = 0;
      m31 = 0;
      m32 = 0;
      m33 = 1;
      m34 = 0;
      m41 = 0;
      m42 = 0;
      m43 = 0;
      m44 = 1;

      constructor(_init?: unknown) {}
      multiplySelf(): this {
        return this;
      }
      preMultiplySelf(): this {
        return this;
      }
      translateSelf(): this {
        return this;
      }
      scaleSelf(): this {
        return this;
      }
      rotateSelf(): this {
        return this;
      }
      inverse(): this {
        return this;
      }
      invertSelf(): this {
        return this;
      }
      transformPoint<T>(point: T): T {
        return point;
      }
    }

    globalScope.DOMMatrix = MinimalDOMMatrix as unknown as typeof DOMMatrix;
  }

  if (!globalScope.ImageData) {
    globalScope.ImageData = class {} as unknown as typeof ImageData;
  }

  if (!globalScope.Path2D) {
    globalScope.Path2D = class {} as unknown as typeof Path2D;
  }
}

function getPdfParseFunction(): PdfParseFunction {
  if (!pdfParseFn) {
    ensurePdfRuntimePolyfills();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParseModule = require("pdf-parse") as
      | PdfParseFunction
      | { default?: PdfParseFunction };

    pdfParseFn =
      typeof pdfParseModule === "function"
        ? pdfParseModule
        : pdfParseModule.default ?? null;

    if (!pdfParseFn) {
      throw new Error("Unable to load pdf-parse function");
    }
  }

  return pdfParseFn;
}

const MIN_BLOCK_CHARS = 30;

export interface ExtractedParagraph {
  text: string;
  pageNumber: number | null;
}

export interface ExtractedDocument {
  text: string;
  pageCount: number | null;
  paragraphs: ExtractedParagraph[];
  sourceType: "pdf" | "doc" | "docx" | "txt";
}

@Injectable()
export class DocumentContentService {
  constructor(private readonly storage: StorageService) {}

  getExtension(sourceName: string): string {
    if (sourceName.startsWith("http://") || sourceName.startsWith("https://")) {
      try {
        return path.extname(new URL(sourceName).pathname).toLowerCase();
      } catch {
        return path.extname(sourceName).toLowerCase();
      }
    }
    return path.extname(sourceName).toLowerCase();
  }

  isSupportedDocument(sourceName: string): boolean {
    return [".pdf", ".doc", ".docx", ".txt"].includes(
      this.getExtension(sourceName)
    );
  }

  async extractFromFileUrl(fileUrl: string): Promise<ExtractedDocument> {
    const buffer = await this.storage.getFileBuffer(fileUrl);
    return this.extractFromBuffer(buffer, fileUrl);
  }

  async extractFromBuffer(
    buffer: Buffer,
    sourceName: string
  ): Promise<ExtractedDocument> {
    const extension = this.getExtension(sourceName);

    switch (extension) {
      case ".pdf":
        return this.extractPdf(buffer);
      case ".docx":
        return this.extractDocx(buffer);
      case ".doc":
        return this.extractDoc(buffer);
      case ".txt":
        return this.extractTextFile(buffer);
      default:
        throw new Error(`Unsupported document type: ${extension || "unknown"}`);
    }
  }

  private async extractPdf(buffer: Buffer): Promise<ExtractedDocument> {
    const parsePdf = getPdfParseFunction();
    const result = await parsePdf(buffer);
    const paragraphs = this.toParagraphs(result.text);

    return {
      text: paragraphs.map((p) => p.text).join("\n\n"),
      pageCount: result.numpages ?? null,
      paragraphs,
      sourceType: "pdf",
    };
  }

  private async extractDocx(buffer: Buffer): Promise<ExtractedDocument> {
    const result = await mammoth.extractRawText({ buffer });
    const paragraphs = this.toParagraphs(result.value);

    return {
      text: paragraphs.map((p) => p.text).join("\n\n"),
      pageCount: null,
      paragraphs,
      sourceType: "docx",
    };
  }

  private async extractDoc(buffer: Buffer): Promise<ExtractedDocument> {
    const extractor = new WordExtractor();
    const document = await extractor.extract(buffer);
    const paragraphs = this.toParagraphs(document.getBody());

    return {
      text: paragraphs.map((p) => p.text).join("\n\n"),
      pageCount: null,
      paragraphs,
      sourceType: "doc",
    };
  }

  private async extractTextFile(buffer: Buffer): Promise<ExtractedDocument> {
    const text = buffer.toString("utf8");
    const paragraphs = this.toParagraphs(text);

    return {
      text: paragraphs.map((p) => p.text).join("\n\n"),
      pageCount: null,
      paragraphs,
      sourceType: "txt",
    };
  }

  private toParagraphs(text: string): ExtractedParagraph[] {
    return text
      .split(/\n{2,}/)
      .map((raw) => this.cleanTextBlock(raw))
      .filter((cleanText) => cleanText.length >= MIN_BLOCK_CHARS)
      .map((cleanText) => ({ text: cleanText, pageNumber: null }));
  }

  private cleanTextBlock(text: string): string {
    return text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  }
}
