import { Injectable } from '@nestjs/common';
import { IndexStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CHUNK_OVERLAP_WORDS } from './material-indexer.service';
import {
  MaterialAccessContext,
  buildMaterialAccessSql,
  buildMaterialAccessWhere,
  canAccessMaterial,
} from './material-access.util';

export interface ChunkSearchResult {
  id: string;
  materialId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  pageNumber: number | null;
  material: {
    title: string;
    type: string;
    authorName: string;
    facultyCode: string | null;
    courseCode: string | null;
  };
}

export interface IndexedMaterialSummary {
  id: string;
  title: string;
  type: string;
  authorName: string;
  facultyCode: string | null;
  courseCode: string | null;
  chunkCount: number;
}

@Injectable()
export class MaterialSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccessContextForUser(
    userId: string,
    role: Role,
  ): Promise<MaterialAccessContext> {
    if (role === Role.ADMIN || role === Role.STAFF) {
      return { userId, role, facultyCode: null, courseCodes: [] };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        courses: true,
        faculty: { select: { code: true } },
      },
    });

    return {
      userId,
      role,
      facultyCode: user?.faculty?.code ?? null,
      courseCodes: user?.courses ?? [],
    };
  }

  async countAccessibleIndexedMaterials(
    accessContext: MaterialAccessContext,
  ): Promise<number> {
    return this.prisma.material.count({
      where: {
        isApproved: true,
        isPublished: true,
        indexStatus: IndexStatus.INDEXED,
        ...buildMaterialAccessWhere(accessContext),
      },
    });
  }

  /**
   * Full-text search across all indexed, published, approved material chunks.
   */
  async searchChunks(
    query: string,
    accessContext: MaterialAccessContext,
    options: {
      materialId?: string;
      facultyCode?: string;
      limit?: number;
    } = {},
  ): Promise<ChunkSearchResult[]> {
    const safeLimit = Math.min(options.limit ?? 5, 10);

    const conditions: string[] = [
      `m."isApproved" = true`,
      `m."isPublished" = true`,
      `m."indexStatus" = 'INDEXED'`,
      `to_tsvector('simple', mc.content) @@ websearch_to_tsquery('simple', $1)`,
    ];

    const params: unknown[] = [query];
    let paramIdx = 2;

    if (options.materialId) {
      conditions.push(`mc."materialId" = $${paramIdx++}`);
      params.push(options.materialId);
    }

    if (options.facultyCode) {
      conditions.push(`m."facultyCode" = $${paramIdx++}`);
      params.push(options.facultyCode);
    }

    const access = buildMaterialAccessSql(accessContext, paramIdx);
    if (access.clause) {
      conditions.push(access.clause);
      params.push(...access.params);
      paramIdx = access.nextParamIndex;
    }

    const sql = `
      SELECT
        mc.id,
        mc."materialId",
        mc."chunkIndex",
        mc.content,
        mc."tokenCount",
        mc."pageNumber",
        m.title            AS "materialTitle",
        m.type             AS "materialType",
        m."authorName",
        m."facultyCode",
        m."courseCode"
      FROM material_chunks mc
      JOIN materials m ON m.id = mc."materialId"
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        ts_rank(
          to_tsvector('simple', mc.content),
          websearch_to_tsquery('simple', $1)
        ) DESC
      LIMIT ${safeLimit}
    `;

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        materialId: string;
        chunkIndex: number;
        content: string;
        tokenCount: number;
        pageNumber: number | null;
        materialTitle: string;
        materialType: string;
        authorName: string;
        facultyCode: string | null;
        courseCode: string | null;
      }>
    >(sql, ...params);

    return rows.map((row) => ({
      id: row.id,
      materialId: row.materialId,
      chunkIndex: row.chunkIndex,
      content: row.content,
      tokenCount: row.tokenCount,
      pageNumber: row.pageNumber,
      material: {
        title: row.materialTitle,
        type: row.materialType,
        authorName: row.authorName,
        facultyCode: row.facultyCode,
        courseCode: row.courseCode,
      },
    }));
  }

  async getAccessibleChunkId(
    materialId: string,
    chunkIndex: number,
    accessContext: MaterialAccessContext,
  ): Promise<string | null> {
    const chunk = await this.prisma.materialChunk.findFirst({
      where: {
        materialId,
        chunkIndex,
        material: {
          isApproved: true,
          isPublished: true,
          indexStatus: IndexStatus.INDEXED,
          ...buildMaterialAccessWhere(accessContext),
        },
      },
      select: { id: true },
    });

    return chunk?.id ?? null;
  }

  /**
   * Context expansion: given a chunkId, return that chunk plus the one before and after.
   */
  async getChunkNeighbors(
    chunkId: string,
    accessContext: MaterialAccessContext,
  ): Promise<ChunkSearchResult[]> {
    const target = await this.prisma.materialChunk.findUnique({
      where: { id: chunkId },
      include: {
        material: {
          select: {
            title: true,
            type: true,
            authorName: true,
            facultyCode: true,
            courseCode: true,
            accessLevel: true,
            uploadedById: true,
            isApproved: true,
            isPublished: true,
          },
        },
      },
    });

    if (!target) return [];
    if (!target.material.isApproved || !target.material.isPublished) return [];
    if (!canAccessMaterial(target.material, accessContext)) return [];

    const neighbors = await this.prisma.materialChunk.findMany({
      where: {
        materialId: target.materialId,
        chunkIndex: {
          in: [
            target.chunkIndex - 1,
            target.chunkIndex,
            target.chunkIndex + 1,
          ],
        },
      },
      orderBy: { chunkIndex: 'asc' },
    });

    return neighbors.map((n) => ({
      id: n.id,
      materialId: n.materialId,
      chunkIndex: n.chunkIndex,
      content: n.content,
      tokenCount: n.tokenCount,
      pageNumber: n.pageNumber,
      material: {
        title: target.material.title,
        type: target.material.type,
        authorName: target.material.authorName,
        facultyCode: target.material.facultyCode,
        courseCode: target.material.courseCode,
      },
    }));
  }

  /**
   * Document outline: return the first 3 chunks of a specific material.
   */
  async getMaterialOutline(
    materialId: string,
    accessContext: MaterialAccessContext,
  ): Promise<ChunkSearchResult[]> {
    const material = await this.prisma.material.findFirst({
      where: {
        id: materialId,
        isApproved: true,
        isPublished: true,
        indexStatus: IndexStatus.INDEXED,
        ...buildMaterialAccessWhere(accessContext),
      },
      select: {
        title: true,
        type: true,
        authorName: true,
        facultyCode: true,
        courseCode: true,
      },
    });

    if (!material) return [];

    const chunks = await this.prisma.materialChunk.findMany({
      where: { materialId },
      orderBy: { chunkIndex: 'asc' },
      take: 3,
    });

    return chunks.map((c) => ({
      id: c.id,
      materialId: c.materialId,
      chunkIndex: c.chunkIndex,
      content: c.content,
      tokenCount: c.tokenCount,
      pageNumber: c.pageNumber,
      material: {
        title: material.title,
        type: material.type,
        authorName: material.authorName,
        facultyCode: material.facultyCode,
        courseCode: material.courseCode,
      },
    }));
  }

  /**
   * List all indexed, approved, published materials visible to this user.
   */
  async listIndexedMaterials(
    accessContext: MaterialAccessContext,
    options: {
      facultyCode?: string;
      limit?: number;
    } = {},
  ): Promise<IndexedMaterialSummary[]> {
    const materials = await this.prisma.material.findMany({
      where: {
        isApproved: true,
        isPublished: true,
        indexStatus: IndexStatus.INDEXED,
        ...(options.facultyCode ? { facultyCode: options.facultyCode } : {}),
        ...buildMaterialAccessWhere(accessContext),
      },
      select: {
        id: true,
        title: true,
        type: true,
        authorName: true,
        facultyCode: true,
        courseCode: true,
        _count: { select: { chunks: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(options.limit ?? 20, 50),
    });

    return materials.map((m) => ({
      id: m.id,
      title: m.title,
      type: m.type,
      authorName: m.authorName,
      facultyCode: m.facultyCode,
      courseCode: m.courseCode,
      chunkCount: m._count.chunks,
    }));
  }

  /**
   * Merge consecutive chunks from the same material into a single result.
   */
  mergeAdjacentChunks(results: ChunkSearchResult[]): ChunkSearchResult[] {
    if (results.length === 0) return [];

    const sorted = [...results].sort((a, b) => {
      if (a.materialId !== b.materialId) {
        return a.materialId.localeCompare(b.materialId);
      }
      return a.chunkIndex - b.chunkIndex;
    });

    const merged: ChunkSearchResult[] = [];

    for (const chunk of sorted) {
      const last = merged[merged.length - 1];
      const isConsecutive =
        last &&
        last.materialId === chunk.materialId &&
        chunk.chunkIndex === last.chunkIndex + 1;

      if (isConsecutive) {
        const continuationWords = chunk.content.split(/\s+/).slice(CHUNK_OVERLAP_WORDS);
        last.content = last.content.trimEnd() + ' ' + continuationWords.join(' ');
        last.chunkIndex = chunk.chunkIndex;
        last.tokenCount += chunk.tokenCount;
      } else {
        merged.push({ ...chunk });
      }
    }

    return merged;
  }
}
