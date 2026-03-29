import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { BorrowsService } from "./borrows.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Role } from "@prisma/client";
import {
  BorrowQueryDto,
  BorrowHistoryQueryDto,
  MostBorrowedQueryDto,
  TrendsQueryDto,
} from "./dto/borrows.dto";

@ApiTags("borrows")
@Controller("borrows")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BorrowsController {
  constructor(private readonly borrowsService: BorrowsService) {}

  @Get("my")
  @ApiOperation({ summary: "Get my borrows" })
  async getMyBorrows(@CurrentUser("id") userId: string) {
    return this.borrowsService.findMyBorrows(userId);
  }

  @Get("active")
  @ApiOperation({ summary: "Get my active borrows" })
  async getActiveBorrows(@CurrentUser("id") userId: string) {
    return this.borrowsService.findActiveBorrows(userId);
  }

  @Get("history")
  @ApiOperation({ summary: "Get my borrow history" })
  async getMyHistory(
    @CurrentUser("id") userId: string,
    @Query() dto: BorrowHistoryQueryDto,
  ) {
    return this.borrowsService.findMyHistory(userId, {
      page: dto.page,
      pageSize: dto.pageSize,
    });
  }

  @Get("admin/active")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Get all active borrows for admin" })
  async getAllActiveBorrowsForAdmin() {
    return this.borrowsService.findAllActiveBorrowsForAdmin();
  }

  @Get("admin/history")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Get all borrow history (admin)" })
  async getAllHistory(@Query() dto: BorrowHistoryQueryDto) {
    return this.borrowsService.findAllHistory({
      page: dto.page,
      pageSize: dto.pageSize,
      userId: dto.userId,
      bookId: dto.bookId,
      role: dto.role,
      status: dto.status,
      startDate: dto.startDate,
      endDate: dto.endDate,
    });
  }

  @Get("admin/most-borrowed")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Get most borrowed books" })
  async getMostBorrowed(@Query() dto: MostBorrowedQueryDto) {
    return this.borrowsService.getMostBorrowedBooks(dto.limit ?? 10);
  }

  @Get("admin/trends")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Get borrow trends" })
  async getTrends(@Query() dto: TrendsQueryDto) {
    return this.borrowsService.getBorrowTrends(dto.months ?? 6);
  }

  @Get("admin/statistics")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Get complete statistics summary" })
  async getStatistics() {
    return this.borrowsService.getStatisticsSummary();
  }

  @Get("stats")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Get borrow statistics" })
  async getStats() {
    return this.borrowsService.getBorrowStats();
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Get all borrows (admin only)" })
  async getAllBorrows(@Query() dto: BorrowQueryDto) {
    return this.borrowsService.findAllBorrows({
      status: dto.status,
      userId: dto.userId,
      page: dto.page,
      pageSize: dto.pageSize,
    });
  }

  @Patch(":id/extend")
  @ApiOperation({ summary: "Extend a borrow" })
  async extendBorrow(
    @Param("id") id: string,
    @CurrentUser("id") userId: string,
    @CurrentUser("role") role: Role
  ) {
    return this.borrowsService.extendBorrow(id, userId, role);
  }

  @Patch(":id/return")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Return a book (admin only)" })
  async returnBook(@Param("id") id: string) {
    return this.borrowsService.returnBook(id);
  }
}
