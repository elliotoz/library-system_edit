import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MaterialIndexerService } from "./material-indexer.service";
import { MaterialSearchService } from "./material-search.service";
import {
  CreateMaterialDto,
  UpdateMaterialDto,
  MaterialQueryDto,
  ApproveMaterialDto,
} from "./dto/materials.dto";
import { Role, MaterialType, AccessLevel, IndexStatus } from "@prisma/client";
import { buildMaterialAccessWhere, canAccessMaterial } from "./material-access.util";

@Injectable()
export class MaterialsService {
  private readonly logger = new Logger(MaterialsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private readonly materialIndexer: MaterialIndexerService,
    private readonly materialSearch: MaterialSearchService,
  ) {}

  async findAllPublic(query: MaterialQueryDto, userId: string, userRole: Role) {
    const { search, type, facultyCode, courseCode, year } = query;
    const accessContext = await this.materialSearch.getAccessContextForUser(
      userId,
      userRole,
    );

    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 12;

    const where: any = {
      isPublished: true,
      isApproved: true,
      AND: [buildMaterialAccessWhere(accessContext)],
    };

    if (search) {
      where.AND.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { authorName: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { keywords: { hasSome: [search] } },
        ],
      });
    }

    if (type) where.type = type;
    if (facultyCode) where.facultyCode = facultyCode;
    if (courseCode) where.courseCode = courseCode;
    if (year) where.year = Number(year);

    const [materials, total] = await Promise.all([
      this.prisma.material.findMany({
        where,
        include: {
          uploadedBy: {
            select: { id: true, name: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.material.count({ where }),
    ]);

    return {
      data: materials,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findAllAdmin(query: MaterialQueryDto) {
    const { search, type, facultyCode, status } = query;

    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 12;

    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { authorName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (type) where.type = type;
    if (facultyCode) where.facultyCode = facultyCode;

    if (status === "pending") {
      where.isApproved = false;
    } else if (status === "approved") {
      where.isApproved = true;
    }

    const [materials, total] = await Promise.all([
      this.prisma.material.findMany({
        where,
        include: {
          uploadedBy: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.material.count({ where }),
    ]);

    return {
      data: materials,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findMyMaterials(userId: string, query: MaterialQueryDto) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 12;

    const where = { uploadedById: userId };

    const [materials, total] = await Promise.all([
      this.prisma.material.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.material.count({ where }),
    ]);

    return {
      data: materials,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findById(id: string, userId: string, userRole: Role) {
    const material = await this.getMaterialOrThrow(id);
    const accessContext = await this.materialSearch.getAccessContextForUser(
      userId,
      userRole,
    );

    if (!canAccessMaterial(material, accessContext)) {
      throw new ForbiddenException("You do not have access to this material");
    }

    return material;
  }

  async create(dto: CreateMaterialDto, userId: string, userRole: Role) {
    if (userRole !== Role.INSTRUCTOR && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only instructors and admins can submit materials');
    }
    const isAdmin = userRole === Role.ADMIN;

    const material = await this.prisma.material.create({
      data: {
        title: dto.title,
        type: dto.type,
        description: dto.description,
        authorName: dto.authorName,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        keywords: dto.keywords || [],
        facultyCode: dto.facultyCode,
        courseCode: dto.courseCode,
        year: dto.year,
        accessLevel: dto.accessLevel || AccessLevel.PUBLIC,
        uploadedById: userId,
        isPublished: isAdmin ? (dto.isPublished ?? true) : false,
        isApproved: isAdmin,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    if (!isAdmin) {
      const admins = await this.prisma.user.findMany({
        where: { role: Role.ADMIN },
        select: { id: true },
      });

      for (const admin of admins) {
        await this.notificationsService.create({
          userId: admin.id,
          type: "SYSTEM",
          title: "New Material Submission",
          message: `${material.uploadedBy.name} submitted "${material.title}" for approval.`,
        });
      }
    }

    if (isAdmin && material.fileUrl) {
      this.materialIndexer.indexMaterial(material.id).catch((err) =>
        this.logger.error(`Auto-index failed for new material ${material.id}: ${String(err)}`),
      );
    }

    return material;
  }

  async update(
    id: string,
    dto: UpdateMaterialDto,
    userId: string,
    userRole: Role
  ) {
    const material = await this.getMaterialOrThrow(id);

    if (userRole !== Role.ADMIN && material.uploadedById !== userId) {
      throw new ForbiddenException("You can only edit your own materials");
    }

    if (userRole !== Role.ADMIN) {
      delete dto.isApproved;
      delete dto.isPublished;
    }

    return this.prisma.material.update({
      where: { id },
      data: dto,
      include: {
        uploadedBy: {
          select: { id: true, name: true, role: true },
        },
      },
    });
  }

  async approve(id: string, dto: ApproveMaterialDto) {
    const material = await this.getMaterialOrThrow(id);

    const updated = await this.prisma.material.update({
      where: { id },
      data: {
        isApproved: dto.approved,
        isPublished: dto.approved,
      },
    });

    await this.notificationsService.create({
      userId: material.uploadedById,
      type: "SYSTEM",
      title: dto.approved ? "Material Approved" : "Material Rejected",
      message: dto.approved
        ? `Your material "${material.title}" has been approved and is now published.`
        : `Your material "${material.title}" was rejected. ${dto.rejectionReason || ""}`,
    });

    if (dto.approved && updated.fileUrl) {
      this.materialIndexer.indexMaterial(updated.id).catch((err) =>
        this.logger.error(`Background index failed for ${updated.id}: ${String(err)}`),
      );
    }

    return updated;
  }

  async delete(id: string, userId: string, userRole: Role) {
    const material = await this.getMaterialOrThrow(id);

    if (userRole !== Role.ADMIN && material.uploadedById !== userId) {
      throw new ForbiddenException("You can only delete your own materials");
    }

    await this.prisma.material.delete({ where: { id } });

    return { message: "Material deleted successfully" };
  }

  async getTypes() {
    return Object.values(MaterialType);
  }

  async getStats() {
    const [total, pending, approved, byType] = await Promise.all([
      this.prisma.material.count(),
      this.prisma.material.count({
        where: { isApproved: false },
      }),
      this.prisma.material.count({ where: { isApproved: true } }),
      this.prisma.material.groupBy({
        by: ["type"],
        _count: { type: true },
      }),
    ]);

    return {
      total,
      pending,
      approved,
      byType: byType.map((t) => ({ type: t.type, count: t._count.type })),
    };
  }

  async reindexMaterial(materialId: string): Promise<{ message: string }> {
    await this.getMaterialOrThrow(materialId);

    this.materialIndexer.indexMaterial(materialId).catch((err) =>
      this.logger.error(`Re-index failed for ${materialId}: ${String(err)}`),
    );

    return { message: "Re-indexing started. Refresh in a few seconds." };
  }

  async reindexPending(): Promise<{ queued: number }> {
    const materials = await this.prisma.material.findMany({
      where: {
        isApproved: true,
        isPublished: true,
        indexStatus: { in: [IndexStatus.PENDING, IndexStatus.FAILED] },
        fileUrl: { not: null },
      },
      select: { id: true },
    });

    for (const m of materials) {
      this.materialIndexer.indexMaterial(m.id).catch((err) =>
        this.logger.error(`Batch re-index failed for ${m.id}: ${String(err)}`),
      );
    }

    this.logger.log(`Batch re-index queued ${materials.length} materials`);
    return { queued: materials.length };
  }

  private async getMaterialOrThrow(id: string) {
    const material = await this.prisma.material.findUnique({
      where: { id },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    if (!material) {
      throw new NotFoundException(`Material with ID ${id} not found`);
    }

    return material;
  }
}

