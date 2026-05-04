import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from "@nestjs/swagger";
import { diskStorage } from "multer";
import { extname } from "path";
import { randomUUID } from "crypto";
import { MaterialsService } from "./materials.service";
import { StorageService } from "../storage/storage.service";
import {
  CreateMaterialDto,
  UpdateMaterialDto,
  MaterialQueryDto,
  ApproveMaterialDto,
} from "./dto/materials.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "@prisma/client";

const storage = diskStorage({
  destination: "./uploads/materials",
  filename: (
    req: Express.Request,
    file: Express.Multer.File,
    callback: (error: Error | null, filename: string) => void
  ) => {
    const uniqueName = `${randomUUID()}${extname(file.originalname)}`;
    callback(null, uniqueName);
  },
});

@ApiTags("materials")
@Controller("materials")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MaterialsController {
  constructor(
    private readonly materialsService: MaterialsService,
    private readonly storageService: StorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get all published materials visible to the current user" })
  async findAll(
    @Query() query: MaterialQueryDto,
    @Request() req: { user: { id: string; role: Role } },
  ) {
    return this.materialsService.findAllPublic(query, req.user.id, req.user.role);
  }

  @Get("types")
  @ApiOperation({ summary: "Get all material types" })
  async getTypes() {
    return this.materialsService.getTypes();
  }

  @Get("my")
  @ApiOperation({ summary: "Get my material submissions" })
  async findMy(
    @Request() req: { user: { id: string; role: Role } },
    @Query() query: MaterialQueryDto
  ) {
    return this.materialsService.findMyMaterials(req.user.id, query);
  }

  @Get("admin")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Get all materials for admin (including pending)" })
  async findAllAdmin(
    @Query()
    query: MaterialQueryDto & { status?: "all" | "pending" | "approved" }
  ) {
    return this.materialsService.findAllAdmin(query);
  }

  @Get("admin/stats")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Get material statistics" })
  async getStats() {
    return this.materialsService.getStats();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get material by ID if accessible" })
  async findById(
    @Param("id") id: string,
    @Request() req: { user: { id: string; role: Role } },
  ) {
    return this.materialsService.findById(id, req.user.id, req.user.role);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiOperation({ summary: "Create new material" })
  async create(
    @Body() dto: CreateMaterialDto,
    @Request() req: { user: { id: string; role: Role } }
  ) {
    return this.materialsService.create(dto, req.user.id, req.user.role);
  }

  @Post("upload")
  @UseGuards(RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiOperation({ summary: "Upload material file" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", {
      storage,
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (
        req: Express.Request,
        file: Express.Multer.File,
        callback: (error: Error | null, acceptFile: boolean) => void
      ) => {
        const allowedTypes = [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "video/mp4",
          "video/webm",
          "text/plain",
        ];
        if (allowedTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new Error("Invalid file type"), false);
        }
      },
    })
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { error: "No file uploaded" };
    }

    const fileUrl = await this.storageService.uploadFile(file, "materials");

    return {
      fileUrl,
      fileName: file.originalname,
      fileSize: file.size,
    };
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update material" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateMaterialDto,
    @Request() req: { user: { id: string; role: Role } }
  ) {
    return this.materialsService.update(id, dto, req.user.id, req.user.role);
  }

  @Patch(":id/approve")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Approve or reject material submission" })
  async approve(@Param("id") id: string, @Body() dto: ApproveMaterialDto) {
    return this.materialsService.approve(id, dto);
  }

  @Post(":id/reindex")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Re-trigger AI text indexing for a single material" })
  async reindex(@Param("id") id: string) {
    return this.materialsService.reindexMaterial(id);
  }

  @Post("admin/reindex-pending")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Batch re-index all PENDING and FAILED materials" })
  async reindexPending() {
    return this.materialsService.reindexPending();
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete material" })
  async delete(
    @Param("id") id: string,
    @Request() req: { user: { id: string; role: Role } }
  ) {
    return this.materialsService.delete(id, req.user.id, req.user.role);
  }
}
