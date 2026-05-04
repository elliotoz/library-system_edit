import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IndexStatus } from '@prisma/client';
import { DocumentContentService } from '../storage/document-content.service';

/** Target chunk size in words (~500 tokens at ~1.25 words/token) */
const CHUNK_WORDS = 400;
/** Word overlap carried from one chunk into the next — exported so search service can strip it on merge */
export const CHUNK_OVERLAP_WORDS = 40;
/** Minimum content length — discard noise-only chunks */
const MIN_CHUNK_CHARS = 30;

interface Paragraph {
  text: string;
  /** 1-based page number from PDF; null for Word/text documents */
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly documentContent: DocumentContentService,
  ) {}

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

      const ext = this.documentContent.getExtension(material.fileUrl);
      const supported = ['.pdf', '.docx', '.doc', '.txt'];

      if (!supported.includes(ext)) {
        await this.setStatus(materialId, IndexStatus.NOT_APPLICABLE);
        return;
      }

      await this.setStatus(materialId, IndexStatus.PROCESSING);

      try {
        const extracted = await this.documentContent.extractFromFileUrl(material.fileUrl);
        const chunks = this.buildChunks(extracted.paragraphs as Paragraph[]);

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
          tokenCount: Math.ceil(chunk.content.length / 4),
          pageNumber: chunk.pageNumber,
        }));

        await this.prisma.$transaction([
          this.prisma.materialChunk.deleteMany({ where: { materialId } }),
          this.prisma.materialChunk.createMany({ data: chunkData }),
        ]);

        await this.setStatus(materialId, IndexStatus.INDEXED);
        this.logger.log(
          `Indexed "${material.title}" (${materialId}): ${chunks.length} chunks`,
        );
      } catch (err) {
        this.logger.error(
          `Index failed for material ${materialId}: ${String(err)}`,
        );
        await this.setStatus(materialId, IndexStatus.FAILED);
      }
    } finally {
      this.inFlight.delete(materialId);
    }
  }

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
        chunks.push({
          content: currentWords.join(' '),
          pageNumber: currentPage,
        });

        const overlap = currentWords.slice(-CHUNK_OVERLAP_WORDS);
        currentWords = [...overlap, ...words];
        currentPage = para.pageNumber;
      } else {
        if (currentWords.length === 0) {
          currentPage = para.pageNumber;
        }
        currentWords.push(...words);
      }
    }

    if (currentWords.length > 0) {
      chunks.push({ content: currentWords.join(' '), pageNumber: currentPage });
    }

    return chunks.filter((c) => c.content.length >= MIN_CHUNK_CHARS);
  }
}
