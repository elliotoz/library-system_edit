import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IndexStatus } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as mammoth from 'mammoth';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf');

// Set up worker path for pdfjs in Node.js environment
if (typeof window === 'undefined') {
  const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.min.js');
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
}

/** Target chunk size in words (~500 tokens at ~1.25 words/token) */
const CHUNK_WORDS = 400;
/** Word overlap carried from one chunk into the next — exported so search service can strip it on merge */
export const CHUNK_OVERLAP_WORDS = 40;
/** Minimum content length — discard noise-only chunks */
const MIN_CHUNK_CHARS = 30;

interface Paragraph {
  text: string;
  /** 1-based page number from PDF; null for DOCX (no page data available) */
  pageNumber: number | null;
}

interface Chunk {
  content: string;
  pageNumber: number | null;
}

@Injectable()
export class MaterialIndexerService {
  private readonly logger = new Logger(MaterialIndexerService.name);
  /** Prevents concurrent indexing of the same material from causing unique constraint violations */
  private readonly inFlight = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public entry point — call fire-and-forget from the approval flow.
   * Updates indexStatus throughout so the admin UI can show live progress.
   * Guards against concurrent re-index calls for the same material.
   */
  async indexMaterial(materialId: string): Promise<void> {
    if (this.inFlight.has(materialId)) {
      this.logger.warn(`indexMaterial: ${materialId} already in progress, skipping`);
      return;
    }
    this.inFlight.add(materialId);

    try {
      const material = await this.prisma.material.findUnique({
        where: { id: materialId },
      });

      if (!material) {
        this.logger.warn(`indexMaterial: material ${materialId} not found`);
        return;
      }

      if (!material.fileUrl) {
        await this.setStatus(materialId, IndexStatus.NOT_APPLICABLE);
        return;
      }

      const ext = path.extname(material.fileUrl).toLowerCase();
      const supported = ['.pdf', '.docx', '.doc'];

      if (!supported.includes(ext)) {
        // Videos, PowerPoints, etc. — not text-indexable
        await this.setStatus(materialId, IndexStatus.NOT_APPLICABLE);
        return;
      }

      await this.setStatus(materialId, IndexStatus.PROCESSING);

      try {
        const buffer = await this.fetchFile(material.fileUrl);

        const paragraphs =
          ext === '.pdf'
            ? await this.extractPdfParagraphs(buffer)
            : await this.extractDocxParagraphs(buffer);

        const chunks = this.buildChunks(paragraphs);

        if (chunks.length === 0) {
          this.logger.warn(
            `Material ${materialId}: extracted 0 chunks — file may be image-only or empty`,
          );
          await this.setStatus(materialId, IndexStatus.FAILED);
          return;
        }

        const chunkData = chunks.map((chunk, chunkIndex) => ({
          materialId,
          chunkIndex,
          content: chunk.content,
          tokenCount: Math.ceil(chunk.content.length / 4), // ~4 chars per token
          pageNumber: chunk.pageNumber,
        }));

        // Atomic delete-then-insert: prevents duplicate chunks under concurrent access
        await this.prisma.$transaction([
          this.prisma.materialChunk.deleteMany({ where: { materialId } }),
          this.prisma.materialChunk.createMany({ data: chunkData }),
        ]);

        await this.setStatus(materialId, IndexStatus.INDEXED);
        this.logger.log(
          `✅ Indexed "${material.title}" (${materialId}): ${chunks.length} chunks`,
        );
      } catch (err) {
        this.logger.error(
          `❌ Index failed for material ${materialId}: ${String(err)}`,
        );
        await this.setStatus(materialId, IndexStatus.FAILED);
      }
    } finally {
      this.inFlight.delete(materialId);
    }
  }

  // ── Private helpers ────────────────────────────────────────────

  private async setStatus(
    materialId: string,
    status: IndexStatus,
  ): Promise<void> {
    await this.prisma.material.update({
      where: { id: materialId },
      data: { indexStatus: status },
    });
  }

  /**
   * Download the file as a Buffer.
   * Handles both S3/CDN public URLs (https://…) and local Multer disk paths (/uploads/…).
   */
  private async fetchFile(fileUrl: string): Promise<Buffer> {
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      const res = await fetch(fileUrl, {
        signal: AbortSignal.timeout(30_000),
        headers: { 'User-Agent': 'LibrarySystem-Indexer/1.0' },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} fetching ${fileUrl}`);
      }
      return Buffer.from(await res.arrayBuffer());
    }
    // Local disk — fileUrl is like /uploads/materials/uuid.pdf
    const localPath = path.join(process.cwd(), fileUrl);
    return fs.readFile(localPath);
  }

  /**
   * Extract paragraphs from a PDF with 1-based page numbers.
   * Uses pdfjs-dist to parse PDF and extract text page-by-page.
   */
  private async extractPdfParagraphs(buffer: Buffer): Promise<Paragraph[]> {
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const paragraphs: Paragraph[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      const rawParagraphs = pageText.split(/\n{2,}/);

      for (const raw of rawParagraphs) {
        const text = raw.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        if (text.length >= MIN_CHUNK_CHARS) {
          paragraphs.push({ text, pageNumber: pageNum });
        }
      }
    }

    return paragraphs;
  }

  /**
   * Extract paragraphs from a DOCX.
   * mammoth does not expose page numbers, so pageNumber is null for all DOCX paragraphs.
   */
  private async extractDocxParagraphs(buffer: Buffer): Promise<Paragraph[]> {
    const result = await mammoth.extractRawText({ buffer });
    const rawParagraphs = result.value.split(/\n{2,}/);

    return rawParagraphs
      .map((raw) => raw.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
      .filter((text) => text.length >= MIN_CHUNK_CHARS)
      .map((text) => ({ text, pageNumber: null }));
  }

  /**
   * Group paragraphs into overlapping word-window chunks.
   * A new chunk starts OVERLAP_WORDS before the end of the previous one.
   * pageNumber is set to the first paragraph's page in each chunk.
   */
  private buildChunks(paragraphs: Paragraph[]): Chunk[] {
    const chunks: Chunk[] = [];
    let currentWords: string[] = [];
    let currentPage: number | null = null;

    for (const para of paragraphs) {
      const words = para.text.split(/\s+/).filter((w) => w.length > 0);

      if (
        currentWords.length > 0 &&
        currentWords.length + words.length > CHUNK_WORDS
      ) {
        // Flush the current chunk
        chunks.push({
          content: currentWords.join(' '),
          pageNumber: currentPage,
        });

        // Carry CHUNK_OVERLAP_WORDS into the next chunk for continuity
        const overlap = currentWords.slice(-CHUNK_OVERLAP_WORDS);
        currentWords = [...overlap, ...words];
        currentPage = para.pageNumber; // new chunk starts on this paragraph's page
      } else {
        if (currentWords.length === 0) {
          // First paragraph of a new chunk — record its page
          currentPage = para.pageNumber;
        }
        currentWords.push(...words);
      }
    }

    // Flush the final chunk
    if (currentWords.length > 0) {
      chunks.push({ content: currentWords.join(' '), pageNumber: currentPage });
    }

    return chunks.filter((c) => c.content.length >= MIN_CHUNK_CHARS);
  }
}
