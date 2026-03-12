import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { BranchesService } from "./branches.service";
import { CreateBranchDto, UpdateBranchDto } from "./dto/branches.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "@prisma/client";

@ApiTags("branches")
@Controller("branches")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Get all branches" })
  async findAll() {
    return this.branchesService.findAll();
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Create a new branch" })
  async create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Patch(":id")
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Update a branch" })
  async update(@Param("id") id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(id, dto);
  }

  @Patch(":id/activate")
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Activate a branch" })
  async activate(@Param("id") id: string) {
    return this.branchesService.activate(id);
  }

  @Patch(":id/deactivate")
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Deactivate a branch" })
  async deactivate(@Param("id") id: string) {
    return this.branchesService.deactivate(id);
  }
}
