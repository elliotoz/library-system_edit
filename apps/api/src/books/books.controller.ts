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
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { BooksService } from "./books.service";
import { BookQueryDto, CreateBookDto, UpdateBookDto } from "./dto/books.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "@prisma/client";

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
}
