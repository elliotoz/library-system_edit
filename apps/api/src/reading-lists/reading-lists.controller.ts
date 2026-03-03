import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReadingListsService } from './reading-lists.service';
import { CreateReadingListDto, UpdateReadingListDto, AddReadingListItemDto } from './dto/reading-lists.dto';
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

  @Get(':id')
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiOperation({ summary: 'Get a reading list by ID' })
  @ApiResponse({ status: 200, description: 'Reading list retrieved' })
  async findOne(@Param('id') id: string) {
    return this.readingListsService.findOne(id);
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

  @Patch(':id')
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiOperation({ summary: 'Update a reading list' })
  @ApiResponse({ status: 200, description: 'Reading list updated' })
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateReadingListDto,
  ) {
    return this.readingListsService.update(id, userId, dto);
  }

  @Delete(':id')
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a reading list' })
  @ApiResponse({ status: 200, description: 'Reading list deleted' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.readingListsService.remove(id, userId);
  }

  @Post(':id/items')
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiOperation({ summary: 'Add a book to a reading list' })
  @ApiResponse({ status: 201, description: 'Item added to reading list' })
  async addItem(
    @Param('id') listId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AddReadingListItemDto,
  ) {
    return this.readingListsService.addItem(listId, userId, dto);
  }

  @Delete(':id/items/:itemId')
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiOperation({ summary: 'Remove a book from a reading list' })
  @ApiResponse({ status: 200, description: 'Item removed from reading list' })
  async removeItem(
    @Param('id') listId: string,
    @Param('itemId') itemId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.readingListsService.removeItem(listId, itemId, userId);
  }
}
