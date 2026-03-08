import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ContextBuilderService } from './context-builder.service';
import { RoleResponseService } from './role-response.service';
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
    private readonly usersService: UsersService,
  ) {}

  async chat(userId: string, userRole: Role, message: string): Promise<ChatResponse> {
    const ctx = await this.contextBuilder.build(userId, userRole);
    const response = this.roleResponse.respond(ctx, message);

    // Staff interest bootstrap: save interests and re-respond
    if (response.reply === '__SAVE_INTERESTS__') {
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

    return response;
  }
}
