import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReadingListsService } from './reading-lists.service';
import { CreateReadingListDto } from './dto/reading-lists.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('reading-lists')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reading-lists')
export class ReadingListsController {
  constructor(private readonly readingListsService: ReadingListsService) {}

  @Get('my')
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiOperation({ summary: 'Get my reading lists' })
  @ApiResponse({ status: 200, description: 'Reading lists retrieved' })
  async findMyLists(@CurrentUser('id') userId: string) {
    return this.readingListsService.findMyLists(userId);
  }

  @Post()
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiOperation({ summary: 'Create a new reading list' })
  @ApiResponse({ status: 201, description: 'Reading list created' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateReadingListDto,
  ) {
    return this.readingListsService.create(userId, dto);
  }
}
