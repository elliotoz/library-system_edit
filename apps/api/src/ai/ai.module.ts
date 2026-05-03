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
import { OpenRouterProvider } from './providers/openrouter.provider';
import { ProviderFactory } from './providers/provider-factory';
import { ToolHookService } from './tools/tool-hook.service';
import { TokenTrackerService } from './session/token-tracker.service';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MaterialsModule } from '../materials/materials.module';

@Module({
  imports: [UsersModule, PrismaModule, MaterialsModule],
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
    OpenRouterProvider,
    ProviderFactory,
    ToolHookService,
    TokenTrackerService,
  ],
  exports: [AgentService, ProviderFactory],
})
export class AiModule {}
