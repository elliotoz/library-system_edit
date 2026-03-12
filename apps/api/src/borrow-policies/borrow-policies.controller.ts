import { Controller, Get, Patch, Param, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { BorrowPoliciesService } from "./borrow-policies.service";
import { UpdateBorrowPolicyDto } from "./dto/update-policy.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "@prisma/client";

@ApiTags("borrow-policies")
@Controller("borrow-policies")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BorrowPoliciesController {
  constructor(private readonly service: BorrowPoliciesService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Get all borrow policies" })
  async findAll() {
    return this.service.findAll();
  }

  @Patch(":role")
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Update borrow policy by role" })
  async update(
    @Param("role") role: string,
    @Body() dto: UpdateBorrowPolicyDto,
  ) {
    return this.service.updateByRole(role, dto);
  }
}
