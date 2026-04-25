import { Controller, Post, Patch, Get, Delete, Body, Req, Res, Param, Query, UseGuards, HttpCode, UseInterceptors, UploadedFile, BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AiService } from './ai.service';
import { AgentService, ChatChunk } from './agent.service';
import { GroqService } from './groq.service';
import { FileExtractService } from './file-extract.service';
import { TokenTrackerService, TokenUsageSummary } from './session/token-tracker.service';
import { UpdateInterestsDto } from './dto/update-interests.dto';
import { ScanCoverDto } from './dto/scan-cover.dto';
import { Role } from '@prisma/client';
import { Request, Response } from 'express';
import { memoryStorage } from 'multer';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly agentService: AgentService,
    private readonly groq: GroqService,
    private readonly fileExtract: FileExtractService,
    private readonly tokenTrackerService: TokenTrackerService,
  ) {}

  // ── Agentic endpoints (Path A) ──────────────────────────────────

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Ollama availability and model list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStatus() {
    return this.agentService.getStatus();
  }

  @Get('conversations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all conversations for the current user' })
  async getConversations(@CurrentUser('id') userId: string) {
    return this.agentService.getConversations(userId);
  }

  @Post('conversations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new conversation' })
  async createConversation(@CurrentUser('id') userId: string) {
    return this.agentService.createConversation(userId);
  }

  @Delete('conversations/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a conversation and its messages' })
  async deleteConversation(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.agentService.deleteConversation(id, userId);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get messages for a conversation' })
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query('conversationId') conversationId?: string,
  ) {
    return this.agentService.getHistory(userId, conversationId);
  }

  @Get('metrics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get token usage metrics for the current user' })
  async getMetrics(
    @CurrentUser('id') userId: string,
    @Query('conversationId') conversationId?: string,
  ): Promise<TokenUsageSummary> {
    if (conversationId) {
      const owned = await this.agentService.conversationBelongsToUser(conversationId, userId);
      if (!owned) {
        return { totalMessages: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCacheReadTokens: 0, totalCacheCreationTokens: 0, cacheHitRate: 0 };
      }
    }
    return this.tokenTrackerService.getSummary(userId, conversationId);
  }

  @Post('chat')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 15 } })
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a message to the agentic AI assistant (SSE streaming)' })
  async chat(
    @CurrentUser('id') userId: string,
    @Body() body: {
      message: string;
      history?: { role: string; content: string }[];
      hasImage?: boolean;
      imageBase64?: string;
      conversationId?: string;
      fileContent?: string;
      fileName?: string;
    },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const cookieHeader = req.headers.cookie || '';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      const stream = this.agentService.chatStream(
        userId,
        body.message,
        body.history ?? [],
        body.hasImage ?? false,
        body.imageBase64 ?? null,
        cookieHeader,
        body.conversationId,
        body.fileContent,
        body.fileName,
      );

      for await (const chunk of stream) {
        if (chunk.type === 'text') {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({ books: chunk.books })}\n\n`);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  }

  // ── Existing Path B endpoints (unchanged) ───────────────────────

  @Patch('interests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user interests' })
  @ApiResponse({ status: 200, description: 'Interests updated' })
  updateInterests(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateInterestsDto,
  ) {
    return this.aiService.updateInterests(userId, dto.interests);
  }

  @Get('context')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get AI context for current user' })
  @ApiResponse({ status: 200, description: 'Context returned' })
  getContext(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.aiService.getContext(userId, userRole);
  }

  @Post('upload-file')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    fileFilter: (_req, file, cb) => {
      const allowed = ['application/pdf', 'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'];
      const extOk = /\.(pdf|txt|docx|doc|xlsx|xls)$/i.test(file.originalname);
      if (allowed.includes(file.mimetype) || extOk) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Only PDF, DOC, DOCX, XLS, XLSX, and TXT files are allowed'), false);
      }
    },
  }))
  @ApiOperation({ summary: 'Extract text from a PDF, DOC, DOCX, XLS, XLSX, or TXT file for AI context' })
  async uploadFile(@UploadedFile() file: Express.Multer.File & { size?: number }) {
    if (!file) throw new BadRequestException('No file uploaded. Please select a PDF, DOC, DOCX, XLS, XLSX, or TXT file.');
    if ((file.size ?? 0) > 50 * 1024 * 1024) {
      throw new PayloadTooLargeException(
        'File is too large. Maximum allowed size is 50 MB. Please reduce the file size and try again.',
      );
    }
    const result = await this.fileExtract.extractText(file.buffer, file.mimetype, file.originalname);
    return {
      text: result.text,
      wordCount: result.wordCount,
      totalWordCount: result.totalWordCount,
      truncated: result.truncated,
      filename: file.originalname,
    };
  }

  @Post('scan-cover')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Scan a book cover image and extract metadata' })
  @ApiResponse({ status: 200, description: 'Extracted book metadata' })
  @ApiResponse({ status: 403, description: 'Admin only' })
  scanCover(@Body() dto: ScanCoverDto) {
    return this.groq.scanBookCover(dto.image);
  }
}
