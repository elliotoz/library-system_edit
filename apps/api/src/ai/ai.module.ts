import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AgentService } from './agent.service';
import { ContextBuilderService } from './context-builder.service';
import { RoleResponseService } from './role-response.service';
import { CatalogSearchService } from './catalog-search.service';
import { SemanticSearchService } from './semantic-search.service';
import { LearningPathService } from './learning-path.service';
import { ResearchAssistantService } from './research-assistant.service';
import { OllamaService } from './ollama.service';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [UsersModule, PrismaModule],
  controllers: [AiController],
  providers: [
    AiService,
    AgentService,
    ContextBuilderService,
    RoleResponseService,
    CatalogSearchService,
    SemanticSearchService,
    LearningPathService,
    ResearchAssistantService,
    OllamaService,
  ],
  exports: [OllamaService, AgentService],
})
export class AiModule {}
