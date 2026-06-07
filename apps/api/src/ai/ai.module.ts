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
import { ToolHookService } from './tools/tool-hook.service';
import { TokenTrackerService } from './session/token-tracker.service';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MaterialsModule } from '../materials/materials.module';
import { BooksModule } from '../books/books.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { PythonExecutionModule } from './python/python-execution.module';

@Module({
  imports: [UsersModule, PrismaModule, MaterialsModule, BooksModule, DashboardModule, PythonExecutionModule],
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
    ToolHookService,
    TokenTrackerService,
  ],
  exports: [AgentService, OpenRouterProvider],
})
export class AiModule {}
