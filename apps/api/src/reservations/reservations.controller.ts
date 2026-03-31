import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ReservationsService } from "./reservations.service";
import { CreateReservationDto, RejectReservationDto, ReservationQueryDto } from "./dto/reservations.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Role } from "@prisma/client";

@ApiTags("reservations")
@Controller("reservations")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get("my")
  @ApiOperation({ summary: "Get my reservations" })
  async getMyReservations(@CurrentUser("id") userId: string) {
    return this.reservationsService.findMyReservations(userId);
  }

  @Get("my/info")
  @ApiOperation({ summary: "Get my reservation limits and count" })
  async getMyReservationInfo(@CurrentUser("id") userId: string) {
    return this.reservationsService.getUserReservationInfo(userId);
  }

  @Get("pending")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Get pending reservations" })
  async getPendingReservations() {
    return this.reservationsService.findPendingReservations();
  }

  @Get("stats")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Get reservation statistics" })
  async getStats() {
    return this.reservationsService.getStats();
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Get all reservations" })
  async getAllReservations(@Query() dto: ReservationQueryDto) {
    return this.reservationsService.findAllReservations(dto);
  }

  @Post()
  @ApiOperation({ summary: "Create a reservation" })
  async create(
    @CurrentUser("id") userId: string,
    @Body() dto: CreateReservationDto
  ) {
    return this.reservationsService.create(userId, dto);
  }

  @Patch(":id/cancel")
  @ApiOperation({ summary: "Cancel a reservation" })
  async cancel(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.reservationsService.cancel(id, userId);
  }

  @Patch(":id/approve")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Approve a reservation" })
  async approve(@Param("id") id: string) {
    return this.reservationsService.approve(id);
  }

  @Patch(":id/mark-ready")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Mark an approved reservation as ready for pickup" })
  async markReady(@Param("id") id: string) {
    return this.reservationsService.markReady(id);
  }

  @Patch(":id/reject")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Reject a reservation" })
  async reject(@Param("id") id: string, @Body() dto: RejectReservationDto) {
    return this.reservationsService.reject(id, dto.reason);
  }

  @Get("approved")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Get approved reservations" })
  async getApprovedReservations() {
    return this.reservationsService.findApprovedReservations();
  }

  @Get("ready")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Get reservations ready for pickup" })
  async getReadyForPickup() {
    return this.reservationsService.findReadyForPickup();
  }

  @Patch(":id/collect")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: "Mark reservation as collected - creates borrow record",
  })
  async collect(@Param("id") id: string) {
    return this.reservationsService.collect(id);
  }
}
