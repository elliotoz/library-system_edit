import { Controller, Post, Patch, Get, Body, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { UpdateInterestsDto } from './dto/update-interests.dto';
import { Role } from '@prisma/client';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

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
    return this.aiService.chat(userId, userRole, dto.message);
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
}
