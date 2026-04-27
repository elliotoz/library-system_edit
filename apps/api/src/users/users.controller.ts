// src/users/users.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  Patch,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  DefaultValuePipe,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { UsersService } from './users.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateInterestsDto } from './dto/update-interests.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

const avatarStorage = diskStorage({
  destination: './uploads/avatars',
  filename: (
    req: Express.Request,
    file: Express.Multer.File,
    callback: (error: Error | null, filename: string) => void,
  ) => {
    const uniqueName = `${randomUUID()}${extname(file.originalname)}`;
    callback(null, uniqueName);
  },
});

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly storageService: StorageService,
  ) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  @ApiQuery({ name: 'facultyId', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async findAll(
    @Query('role') role?: Role,
    @Query('facultyId') facultyId?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number = 10,
  ) {
    return this.usersService.findAll({
      role,
      facultyId,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  @Get('stats')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get user statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getStats() {
    return this.usersService.getUserStats();
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: avatarStorage,
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (
        req: Express.Request,
        file: Express.Multer.File,
        callback: (error: Error | null, acceptFile: boolean) => void,
      ) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
        }
      },
    }),
  )
  async updateMyProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      dto.avatarUrl = await this.storageService.uploadImage(file, 'avatars');
    }
    return this.usersService.updateProfile(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID — ADMIN or own record only' })
  @ApiResponse({ status: 200, description: 'User retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: Role },
  ) {
    if (currentUser.role !== Role.ADMIN && currentUser.id !== id) {
      throw new ForbiddenException();
    }
    return this.usersService.findById(id);
  }

  @Patch('interests')
  @ApiOperation({ summary: 'Update current user interests' })
  @ApiResponse({ status: 200, description: 'Interests updated' })
  async updateMyInterests(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateInterestsDto,
  ) {
    return this.usersService.updateInterests(userId, dto.interests);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get current user notification preferences' })
  @ApiResponse({ status: 200, description: 'Preferences returned' })
  async getMyPreferences(@CurrentUser('id') userId: string) {
    return this.usersService.getPreferences(userId);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update current user notification preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated' })
  async updateMyPreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.usersService.updatePreferences(userId, dto);
  }

  @Patch(':id/deactivate')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Deactivate user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User deactivated' })
  async deactivateUser(@Param('id') id: string) {
    return this.usersService.deactivateUser(id);
  }

  @Patch(':id/activate')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Activate user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User activated' })
  async activateUser(@Param('id') id: string) {
    return this.usersService.activateUser(id);
  }
}