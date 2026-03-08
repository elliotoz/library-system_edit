import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ContextBuilderService } from './context-builder.service';
import { RoleResponseService } from './role-response.service';
import { CatalogSearchService } from './catalog-search.service';
import { UsersService } from '../users/users.service';

export interface ChatResponse {
  reply: string;
  sources?: string[];
}

@Injectable()
export class AiService {
  constructor(
    private readonly contextBuilder: ContextBuilderService,
    private readonly roleResponse: RoleResponseService,
    private readonly catalogSearch: CatalogSearchService,
    private readonly usersService: UsersService,
  ) {}

  async chat(userId: string, userRole: Role, message: string): Promise<ChatResponse> {
    const ctx = await this.contextBuilder.build(userId, userRole);

    // Staff interest bootstrap: check before anything else
    if (userRole === Role.STAFF && ctx.user.interests.length === 0) {
      const response = this.roleResponse.respond(ctx, message);
      if (response.reply === '__SAVE_INTERESTS__') {
        return this.saveInterests(userId, message);
      }
      return response;
    }

    // Staff updating interests mid-conversation
    if (userRole === Role.STAFF && this.roleResponse.looksLikeInterests(message)) {
      return this.saveInterests(userId, message);
    }

    // Natural-language catalog/reading-list search
    if (this.catalogSearch.isSearchQuery(message)) {
      return this.catalogSearch.search(message, userRole, ctx.user.facultyName);
    }

    // Role-aware response
    return this.roleResponse.respond(ctx, message);
  }

  private async saveInterests(userId: string, message: string): Promise<ChatResponse> {
    const interests = this.roleResponse.parseInterests(message);
    if (interests.length > 0) {
      await this.usersService.updateInterests(userId, interests);
      const interestList = interests.map((i) => `**${i}**`).join(', ');
      return {
        reply:
          `✅ Great! I've saved your interests: ${interestList}\n\n` +
          'Now I can give you personalized recommendations. Try asking me:\n' +
          '- "Suggest books for me"\n' +
          '- "What\'s available in the catalog?"\n' +
          '- "Show me reading lists"',
        sources: ['/dashboard/catalog', '/dashboard/profile'],
      };
    }
    return {
      reply: 'I couldn\'t parse your interests. Please provide them as a comma-separated list, e.g., "finance, technology, history".',
    };
  }
}
