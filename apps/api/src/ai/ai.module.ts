import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ContextBuilderService } from './context-builder.service';
import { RoleResponseService } from './role-response.service';
import { CatalogSearchService } from './catalog-search.service';
import { SemanticSearchService } from './semantic-search.service';
import { LearningPathService } from './learning-path.service';
import { ResearchAssistantService } from './research-assistant.service';
import { OllamaService } from './ollama.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [AiController],
  providers: [
    AiService,
    ContextBuilderService,
    RoleResponseService,
    CatalogSearchService,
    SemanticSearchService,
    LearningPathService,
    ResearchAssistantService,
    OllamaService,
  ],
  exports: [OllamaService],
})
export class AiModule {}
