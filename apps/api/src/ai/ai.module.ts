import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ContextBuilderService } from './context-builder.service';
import { RoleResponseService } from './role-response.service';
import { CatalogSearchService } from './catalog-search.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [AiController],
  providers: [AiService, ContextBuilderService, RoleResponseService, CatalogSearchService],
})
export class AiModule {}
