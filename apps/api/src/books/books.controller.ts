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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
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
import { BooksService } from "./books.service";
import { BookQueryDto, CreateBookDto, UpdateBookDto } from "./dto/books.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "@prisma/client";

const pdfDiskStorage = diskStorage({
  destination: "./uploads/pdfs",
  filename: (
    _req: Express.Request,
    file: Express.Multer.File,
    callback: (error: Error | null, filename: string) => void
  ) => {
    callback(null, `${randomUUID()}${extname(file.originalname)}`);
  },
});

@ApiTags("books")
@Controller("books")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  @ApiOperation({ summary: "Get all books with filtering and pagination" })
  async findAll(@Query() query: BookQueryDto) {
    return this.booksService.findAll(query);
  }

  @Get("categories")
  @ApiOperation({ summary: "Get all book categories" })
  async getCategories() {
    return this.booksService.getCategories();
  }

  @Get("faculties")
  @ApiOperation({ summary: "Get all faculties with book counts" })
  async getFaculties() {
    return this.booksService.getFacultiesWithBookCount();
  }

  @Get("branches")
  @ApiOperation({ summary: "Get all library branches" })
  async getBranches() {
    return this.booksService.getBranches();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get book by ID" })
  async findById(@Param("id") id: string) {
    return this.booksService.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Create a new book (admin only)" })
  async create(@Body() dto: CreateBookDto) {
    return this.booksService.create(dto);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Update a book (admin only)" })
  async update(@Param("id") id: string, @Body() dto: UpdateBookDto) {
    return this.booksService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Delete a book (admin only)" })
  async delete(@Param("id") id: string) {
    return this.booksService.delete(id);
  }

  @Post(":id/copies")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Add copies to a book (admin only)" })
  async addCopies(
    @Param("id") id: string,
    @Body() body: { branchId: string; numberOfCopies: number }
  ) {
    return this.booksService.addCopies(id, body.branchId, body.numberOfCopies);
  }

  @Post("admin/reindex-pending-pdfs")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Queue pending book PDF indexing (admin only)" })
  async reindexPendingPdfs(@Query("limit") limit?: string) {
    return this.booksService.queuePendingPdfIndexing(limit);
  }

  @Post(":id/pdf")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Upload PDF for a book (admin only)" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: pdfDiskStorage,
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (
        _req: Express.Request,
        file: Express.Multer.File,
        callback: (error: Error | null, acceptFile: boolean) => void
      ) => {
        if (file.mimetype === "application/pdf") {
          callback(null, true);
        } else {
          callback(new Error("Only PDF files are allowed"), false);
        }
      },
    })
  )
  async uploadPdf(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) throw new BadRequestException("No PDF file provided");
    return this.booksService.uploadPdf(id, file);
  }
}
