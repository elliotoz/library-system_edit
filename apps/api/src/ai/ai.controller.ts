import { Controller, Post, Patch, Get, Body, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AiService } from './ai.service';
import { OllamaService } from './ollama.service';
import { ChatDto } from './dto/chat.dto';
import { UpdateInterestsDto } from './dto/update-interests.dto';
import { ScanCoverDto } from './dto/scan-cover.dto';
import { Role } from '@prisma/client';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly ollama: OllamaService,
  ) {}

  @Post('chat')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 15 } })
  @ApiOperation({ summary: 'Send a message to the AI assistant' })
  @ApiResponse({ status: 200, description: 'AI reply returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  chat(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
    @Body() dto: ChatDto,
  ) {
    return this.aiService.chat(userId, userRole, dto.message, dto.image);
  }

  @Patch('interests')
  @ApiOperation({ summary: 'Update current user interests' })
  @ApiResponse({ status: 200, description: 'Interests updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  updateInterests(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateInterestsDto,
  ) {
    return this.aiService.updateInterests(userId, dto.interests);
  }

  @Get('context')
  @ApiOperation({ summary: 'Get AI context for current user' })
  @ApiResponse({ status: 200, description: 'Context returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getContext(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.aiService.getContext(userId, userRole);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get Ollama availability status' })
  @ApiResponse({ status: 200, description: 'Status returned' })
  getStatus() {
    return { available: this.ollama.isAvailable() };
  }

  @Post('scan-cover')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Scan a book cover image and extract metadata' })
  @ApiResponse({ status: 200, description: 'Extracted book metadata' })
  @ApiResponse({ status: 403, description: 'Admin only' })
  scanCover(@Body() dto: ScanCoverDto) {
    return this.ollama.scanBookCover(dto.image);
  }
}
