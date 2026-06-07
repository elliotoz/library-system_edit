import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get admin dashboard stats' })
  async getAdminStats() {
    return this.dashboardService.getAdminStats();
  }

  @Get('admin/snapshot')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get grouped admin dashboard snapshot' })
  async getAdminSnapshot() {
    return this.dashboardService.getAdminSnapshot();
  }

  @Get('student')
  @ApiOperation({ summary: 'Get student dashboard stats' })
  async getStudentStats(@CurrentUser('id') userId: string) {
    return this.dashboardService.getStudentStats(userId);
  }

  @Get('instructor')
  @UseGuards(RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiOperation({ summary: 'Get instructor dashboard stats' })
  async getInstructorStats(@CurrentUser('id') userId: string) {
    return this.dashboardService.getInstructorStats(userId);
  }

  @Get('staff')
  @ApiOperation({ summary: 'Get staff dashboard stats' })
  async getStaffStats(@CurrentUser('id') userId: string) {
    return this.dashboardService.getStaffStats(userId);
  }

  @Get('activity')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get recent activity' })
  async getRecentActivity() {
    return this.dashboardService.getRecentActivity();
  }

  @Get('admin/user-distribution')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get active user counts by role' })
  async getUserDistribution() {
    return this.dashboardService.getUserDistribution();
  }

  @Get('admin/ai-metrics')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get AI usage metrics for a period' })
  async getAiMetrics(@Query('period') period: 'week' | 'month' | 'year' = 'week') {
    return this.dashboardService.getAiMetrics(period);
  }
}
