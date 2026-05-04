import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MaterialIndexerService } from "./material-indexer.service";
import {
  CreateMaterialDto,
  UpdateMaterialDto,
  MaterialQueryDto,
  ApproveMaterialDto,
} from "./dto/materials.dto";
import { Role, MaterialType, AccessLevel, IndexStatus } from "@prisma/client";

@Injectable()
export class MaterialsService {
  private readonly logger = new Logger(MaterialsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private readonly materialIndexer: MaterialIndexerService,
  ) {}

  // Get all published & approved materials (public view)
  async findAllPublic(query: MaterialQueryDto) {
    const { search, type, facultyCode, courseCode, year } = query;

    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 12;

    const where: any = {
      isPublished: true,
      isApproved: true,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { authorName: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { keywords: { hasSome: [search] } },
      ];
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

  // Get all materials for admin (including pending)
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

    // Status filter
    if (status === "pending") {
      where.isApproved = false;
    } else if (status === "approved") {
      where.isApproved = true;
    }
    // 'all' or undefined = no filter

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

  // Get materials uploaded by current user
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

  // Get single material
  async findById(id: string) {
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

  // Create material (for instructors - requires approval)
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
        // Admin uploads are auto-approved and published
        isPublished: isAdmin ? (dto.isPublished ?? true) : false,
        isApproved: isAdmin,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    // If not admin, notify admins about new submission
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

    return material;
  }

  // Update material
  async update(
    id: string,
    dto: UpdateMaterialDto,
    userId: string,
    userRole: Role
  ) {
    const material = await this.findById(id);

    // Only admin or the uploader can update
    if (userRole !== Role.ADMIN && material.uploadedById !== userId) {
      throw new ForbiddenException("You can only edit your own materials");
    }

    // Non-admins can't change approval status
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

  // Approve or reject material (admin only)
  async approve(id: string, dto: ApproveMaterialDto) {
    const material = await this.findById(id);

    const updated = await this.prisma.material.update({
      where: { id },
      data: {
        isApproved: dto.approved,
        isPublished: dto.approved, // Auto-publish when approved
      },
    });

    // Notify the uploader
    await this.notificationsService.create({
      userId: material.uploadedById,
      type: "SYSTEM",
      title: dto.approved ? "Material Approved" : "Material Rejected",
      message: dto.approved
        ? `Your material "${material.title}" has been approved and is now published.`
        : `Your material "${material.title}" was rejected. ${dto.rejectionReason || ""}`,
    });

    // Trigger indexing for newly approved materials that have a file
    if (dto.approved && updated.fileUrl) {
      this.materialIndexer.indexMaterial(updated.id).catch((err) =>
        this.logger.error(`Background index failed for ${updated.id}: ${String(err)}`),
      );
    }

    return updated;
  }

  // Delete material
  async delete(id: string, userId: string, userRole: Role) {
    const material = await this.findById(id);

    // Only admin or the uploader can delete
    if (userRole !== Role.ADMIN && material.uploadedById !== userId) {
      throw new ForbiddenException("You can only delete your own materials");
    }

    await this.prisma.material.delete({ where: { id } });

    return { message: "Material deleted successfully" };
  }

  // Get material types for filter dropdown
  async getTypes() {
    return Object.values(MaterialType);
  }

  // Get stats for admin dashboard
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

  // Re-trigger indexing for a single material
  async reindexMaterial(materialId: string): Promise<{ message: string }> {
    await this.findById(materialId); // throws 404 if missing

    this.materialIndexer.indexMaterial(materialId).catch((err) =>
      this.logger.error(`Re-index failed for ${materialId}: ${String(err)}`),
    );

    return { message: "Re-indexing started. Refresh in a few seconds." };
  }

  // Batch re-trigger indexing for all PENDING and FAILED materials
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

    // Fire all in parallel — each one runs asynchronously
    for (const m of materials) {
      this.materialIndexer.indexMaterial(m.id).catch((err) =>
        this.logger.error(`Batch re-index failed for ${m.id}: ${String(err)}`),
      );
    }

    this.logger.log(`Batch re-index queued ${materials.length} materials`);
    return { queued: materials.length };
  }
}
