import { Injectable } from '@nestjs/common';
import { AiContext } from './context-builder.service';
import { ChatResponse } from './ai.service';
import { Role } from '@prisma/client';

@Injectable()
export class RoleResponseService {

  respond(ctx: AiContext, message: string): ChatResponse {
    const lower = message.toLowerCase();

    // Admin-only action requests from non-admins
    if (ctx.user.role !== Role.ADMIN && this.isAdminAction(lower)) {
      return {
        reply:
          `That action requires administrator privileges. As a **${ctx.user.role.toLowerCase()}**, you can:\n\n` +
          '- Browse and search the **Catalog**\n' +
          '- Manage your **Borrowed Books** and **Reservations**\n' +
          '- Explore **Reading Lists** from instructors\n\n' +
          'If you need help with something specific, feel free to ask!',
        modelUsed: 'rule-based',
        sources: ['/dashboard/catalog'],
      };
    }

    switch (ctx.user.role) {
      case Role.STUDENT:
        return this.studentResponse(ctx, lower);
      case Role.INSTRUCTOR:
        return this.instructorResponse(ctx, lower);
      case Role.STAFF:
        return this.staffResponse(ctx, lower, message);
      case Role.ADMIN:
        return this.adminResponse(ctx, lower);
      default:
        return this.genericResponse(ctx, lower);
    }
  }

  // ── Student ────────────────────────────────────────────────────

  private studentResponse(ctx: AiContext, lower: string): ChatResponse {
    const { borrowPolicy: bp, activeBorrows, reservations, catalog } = ctx;
    const remaining = bp.maxActiveBorrows - activeBorrows.count;

    if (this.matches(lower, ['how many', 'can i borrow', 'still borrow', 'limit', 'remaining'])) {
      let reply = `📖 **Your Borrowing Status:**\n` +
        `- Active borrows: **${activeBorrows.count}** / ${bp.maxActiveBorrows}\n` +
        `- Remaining slots: **${remaining}**\n` +
        `- Borrow duration: **${bp.maxBorrowDays} days** per book\n` +
        `- Extensions: up to **${bp.maxExtensions}** (${bp.extensionDays} days each)\n`;

      if (activeBorrows.items.length > 0) {
        reply += '\n📅 **Upcoming due dates:**\n';
        activeBorrows.items.forEach((b) => {
          const due = new Date(b.dueAt).toLocaleDateString();
          reply += `- "${b.title}" — due ${due}\n`;
        });
      }

      return { reply, modelUsed: 'rule-based', sources: ['/dashboard/borrowed'] };
    }

    if (this.matches(lower, ['reserve', 'reservation', 'pick up', 'pickup'])) {
      let reply = `📋 **Your Reservations:**\n` +
        `- Active: **${reservations.count}**\n`;
      if (reservations.readyForPickup > 0) {
        reply += `- **${reservations.readyForPickup}** ready for pickup!\n`;
      }
      if (reservations.pending > 0) {
        reply += `- **${reservations.pending}** pending confirmation\n`;
      }
      reply += `\nYou can check status and pick-up details on the **Reservations** page.`;
      return { reply, modelUsed: 'rule-based', sources: ['/dashboard/reservations'] };
    }

    if (this.matches(lower, ['recommend', 'suggest', 'what should i read', 'good book', 'find book'])) {
      let reply = '📚 **Personalized Suggestions:**\n\n';
      if (ctx.user.facultyName) {
        reply += `Since you're in **${ctx.user.facultyName}**, `;
        if (catalog.facultyBooks > 0) {
          reply += `we have **${catalog.facultyBooks}** books in your faculty's collection. `;
        }
        reply += 'Check the catalog filtered by your faculty!\n\n';
      }
      if (catalog.topCategories.length > 0) {
        reply += `Popular categories: ${catalog.topCategories.map((c) => `**${c}**`).join(', ')}\n\n`;
      }
      if (ctx.readingLists.publishedCount > 0) {
        reply += `📋 There are **${ctx.readingLists.publishedCount}** published reading lists from instructors — great for finding curated selections.`;
      }
      return { reply, modelUsed: 'rule-based', sources: ['/dashboard/catalog', '/dashboard/reading-lists'] };
    }

    if (this.matches(lower, ['reading list', 'course material', 'syllabus'])) {
      let reply = `📋 **Reading Lists:**\n` +
        `- **${ctx.readingLists.publishedCount}** published lists available\n` +
        `- You follow **${ctx.readingLists.followedInstructors}** instructor(s)\n\n` +
        'Browse reading lists or follow instructors to get notified about new lists.';
      return { reply, modelUsed: 'rule-based', sources: ['/dashboard/reading-lists'] };
    }

    if (this.matches(lower, ['borrow', 'return', 'renew', 'extend', 'overdue', 'due'])) {
      let reply = `📖 **Borrowing Info for Students:**\n` +
        `- Max books: **${bp.maxActiveBorrows}**\n` +
        `- Duration: **${bp.maxBorrowDays} days**\n` +
        `- Extensions: **${bp.maxExtensions}** × ${bp.extensionDays} days\n\n` +
        `You currently have **${activeBorrows.count}** active borrow(s).`;
      if (remaining > 0) {
        reply += ` You can borrow **${remaining}** more.`;
      } else {
        reply += ' You\'ve reached your limit — return a book to borrow more.';
      }
      return { reply, modelUsed: 'rule-based', sources: ['/dashboard/borrowed'] };
    }

    return this.genericResponse(ctx, lower);
  }

  // ── Instructor ─────────────────────────────────────────────────

  private instructorResponse(ctx: AiContext, lower: string): ChatResponse {
    const { borrowPolicy: bp, activeBorrows, catalog, readingLists } = ctx;
    const remaining = bp.maxActiveBorrows - activeBorrows.count;

    if (this.matches(lower, ['how many', 'can i borrow', 'still borrow', 'limit', 'remaining'])) {
      return {
        reply:
          `📖 **Your Borrowing Status (Instructor):**\n` +
          `- Active borrows: **${activeBorrows.count}** / ${bp.maxActiveBorrows}\n` +
          `- Remaining: **${remaining}**\n` +
          `- Duration: **${bp.maxBorrowDays} days** per book\n` +
          `- Extensions: **${bp.maxExtensions}** × ${bp.extensionDays} days`,
        modelUsed: 'rule-based',
        sources: ['/dashboard/borrowed'],
      };
    }

    if (this.matches(lower, ['reading list', 'my list', 'create list', 'course list'])) {
      return {
        reply:
          `📋 **Your Reading Lists:**\n` +
          `- You have **${readingLists.ownListCount}** reading list(s)\n` +
          `- **${readingLists.publishedCount}** total published lists in the system\n\n` +
          'You can create, manage, and publish reading lists from your instructor dashboard. ' +
          'Students who follow you will be notified when you publish.',
        modelUsed: 'rule-based',
        sources: ['/dashboard/instructor/reading-lists'],
      };
    }

    if (this.matches(lower, ['recommend', 'suggest', 'advanced', 'teaching', 'course'])) {
      let reply = '📚 **Course & Teaching Resources:**\n\n';
      if (ctx.user.facultyName) {
        reply += `Your faculty (**${ctx.user.facultyName}**) has **${catalog.facultyBooks}** books in the collection.\n\n`;
      }
      reply += `The catalog has **${catalog.totalBooks}** books total with **${catalog.availableCopies}** copies currently available.\n\n`;
      if (catalog.topCategories.length > 0) {
        reply += `Top categories: ${catalog.topCategories.map((c) => `**${c}**`).join(', ')}\n\n`;
      }
      reply += 'Use the **Catalog** to find books, then add them to your **Reading Lists** for students.';
      return { reply, modelUsed: 'rule-based', sources: ['/dashboard/catalog', '/dashboard/instructor/reading-lists'] };
    }

    if (this.matches(lower, ['material', 'publication', 'research', 'submit', 'thesis'])) {
      return {
        reply:
          '📄 **Academic Materials:**\n\n' +
          'As an instructor, you can submit research papers, course materials, and publications.\n\n' +
          '1. Go to **Submit Material** in your dashboard\n' +
          '2. Upload the file and fill in metadata\n' +
          '3. It will be reviewed before publishing\n\n' +
          'Your published materials are visible to students.',
        modelUsed: 'rule-based',
        sources: ['/dashboard/instructor/submit-material'],
      };
    }

    if (this.matches(lower, ['borrow', 'return', 'renew', 'extend', 'overdue'])) {
      return {
        reply:
          `📖 **Instructor Borrowing Privileges:**\n` +
          `- Max books: **${bp.maxActiveBorrows}**\n` +
          `- Duration: **${bp.maxBorrowDays} days**\n` +
          `- Extensions: **${bp.maxExtensions}** × ${bp.extensionDays} days\n\n` +
          `Currently borrowing **${activeBorrows.count}** book(s), **${remaining}** slots available.`,
        modelUsed: 'rule-based',
        sources: ['/dashboard/borrowed'],
      };
    }

    return this.genericResponse(ctx, lower);
  }

  // ── Staff ──────────────────────────────────────────────────────

  staffResponse(ctx: AiContext, lower: string, originalMessage: string): ChatResponse {
    // Staff with no interests: prompt for them
    if (ctx.user.interests.length === 0) {
      // Check if this message looks like interest input
      if (this.looksLikeInterests(originalMessage)) {
        return { reply: '__SAVE_INTERESTS__', modelUsed: 'rule-based', sources: [] };
      }
      return {
        reply:
          `Hi ${ctx.user.name}! To give you personalized recommendations, I need to know your interests.\n\n` +
          '📝 Please tell me your areas of interest (e.g., "finance, technology, history").\n\n' +
          'Just type them as a comma-separated list and I\'ll save them for you!',
        modelUsed: 'rule-based',
      };
    }

    // Staff with interests: personalized responses
    if (this.matches(lower, ['recommend', 'suggest', 'find', 'book', 'read'])) {
      const interestList = ctx.user.interests.map((i) => `**${i}**`).join(', ');
      return {
        reply:
          `📚 Based on your interests (${interestList}):\n\n` +
          `The library has **${ctx.catalog.totalBooks}** books with **${ctx.catalog.availableCopies}** available copies.\n\n` +
          'Try searching the **Catalog** with your interest keywords. ' +
          'You can also explore **Reading Lists** from instructors for curated selections.\n\n' +
          'Want to update your interests? Just tell me your new interests!',
        modelUsed: 'rule-based',
        sources: ['/dashboard/catalog', '/dashboard/reading-lists'],
      };
    }

    if (this.matches(lower, ['borrow', 'return', 'renew', 'limit'])) {
      const { borrowPolicy: bp, activeBorrows } = ctx;
      const remaining = bp.maxActiveBorrows - activeBorrows.count;
      return {
        reply:
          `📖 **Your Borrowing Status:**\n` +
          `- Active: **${activeBorrows.count}** / ${bp.maxActiveBorrows}\n` +
          `- Remaining: **${remaining}**\n` +
          `- Duration: **${bp.maxBorrowDays} days** • Extensions: **${bp.maxExtensions}** × ${bp.extensionDays} days`,
        modelUsed: 'rule-based',
        sources: ['/dashboard/borrowed'],
      };
    }

    // Check if updating interests
    if (this.looksLikeInterests(originalMessage)) {
      return { reply: '__SAVE_INTERESTS__', modelUsed: 'rule-based', sources: [] };
    }

    return this.genericResponse(ctx, lower);
  }

  // ── Admin ──────────────────────────────────────────────────────

  private adminResponse(ctx: AiContext, lower: string): ChatResponse {
    const admin = ctx.admin!;

    if (this.matches(lower, ['pending reservation', 'how many reservation', 'reservation count', 'reservations'])) {
      return {
        reply:
          `📊 **Reservation Overview:**\n` +
          `- Pending reservations: **${admin.pendingReservations}**\n` +
          `- Active loans: **${admin.activeLoans}**\n` +
          `- Overdue loans: **${admin.overdueLoans}**\n\n` +
          'You can manage reservations from the admin dashboard.',
        modelUsed: 'rule-based',
        sources: ['/dashboard/admin/reservations'],
      };
    }

    if (this.matches(lower, ['stats', 'overview', 'dashboard', 'status', 'how is the library', 'summary'])) {
      return {
        reply:
          `📊 **Library Overview:**\n` +
          `- Total active users: **${admin.totalUsers}**\n` +
          `- Active loans: **${admin.activeLoans}**\n` +
          `- Overdue loans: **${admin.overdueLoans}**\n` +
          `- Pending reservations: **${admin.pendingReservations}**\n` +
          `- Books in catalog: **${ctx.catalog.totalBooks}**\n` +
          `- Available copies: **${ctx.catalog.availableCopies}**\n` +
          `- Published reading lists: **${ctx.readingLists.publishedCount}**`,
        modelUsed: 'rule-based',
        sources: ['/dashboard/admin/statistics', '/dashboard/admin'],
      };
    }

    if (this.matches(lower, ['overdue', 'late return', 'delinquent'])) {
      return {
        reply:
          `⚠️ **Overdue Loans:**\n` +
          `There are currently **${admin.overdueLoans}** overdue loan(s).\n\n` +
          'View details in the **Borrows** management page.',
        modelUsed: 'rule-based',
        sources: ['/dashboard/admin/borrows'],
      };
    }

    if (this.matches(lower, ['user', 'manage user', 'accounts'])) {
      return {
        reply:
          `👥 **User Management:**\n` +
          `- Total active users: **${admin.totalUsers}**\n\n` +
          'You can search, activate/deactivate users, and view profiles from the **Users** page.',
        modelUsed: 'rule-based',
        sources: ['/dashboard/admin/users'],
      };
    }

    if (this.matches(lower, ['borrow', 'loan', 'policy'])) {
      return {
        reply:
          `📖 **Loan Overview:**\n` +
          `- Active loans: **${admin.activeLoans}**\n` +
          `- Overdue: **${admin.overdueLoans}**\n` +
          `- Pending reservations: **${admin.pendingReservations}**\n\n` +
          'Manage all borrows from the admin **Borrows** page.',
        modelUsed: 'rule-based',
        sources: ['/dashboard/admin/borrows'],
      };
    }

    if (this.matches(lower, ['reading list'])) {
      return {
        reply:
          `📋 **Reading Lists:**\n` +
          `- Published lists: **${ctx.readingLists.publishedCount}**\n` +
          `- Your lists: **${ctx.readingLists.ownListCount}**\n\n` +
          'Moderate all reading lists from the admin **Reading Lists** page.',
        modelUsed: 'rule-based',
        sources: ['/dashboard/admin/reading-lists'],
      };
    }

    return this.genericResponse(ctx, lower);
  }

  // ── Shared ─────────────────────────────────────────────────────

  private genericResponse(ctx: AiContext, lower: string): ChatResponse {
    if (this.matches(lower, ['help', 'what can you do'])) {
      const roleLabel = ctx.user.role.charAt(0) + ctx.user.role.slice(1).toLowerCase();
      return {
        reply:
          `Hi ${ctx.user.name}! As a **${roleLabel}**, I can help you with:\n\n` +
          '📚 **Book recommendations** — personalized to your profile\n' +
          '📖 **Borrowing info** — your limits, due dates, extensions\n' +
          '📋 **Reading lists** — discover instructor-curated lists\n' +
          '🔍 **Catalog search** — find specific books\n' +
          '📄 **Academic materials** — research and publications\n\n' +
          'What would you like to know?',
        modelUsed: 'rule-based',
      };
    }

    if (this.matches(lower, ['catalog', 'search'])) {
      return {
        reply:
          `🔍 **Library Catalog:**\n` +
          `- **${ctx.catalog.totalBooks}** books in the catalog\n` +
          `- **${ctx.catalog.availableCopies}** copies currently available\n` +
          (ctx.user.facultyName && ctx.catalog.facultyBooks > 0
            ? `- **${ctx.catalog.facultyBooks}** books in your faculty (${ctx.user.facultyName})\n`
            : '') +
          '\nSearch by title, author, ISBN, or subject on the **Catalog** page.',
        modelUsed: 'rule-based',
        sources: ['/dashboard/catalog'],
      };
    }

    const roleLabel = ctx.user.role.charAt(0) + ctx.user.role.slice(1).toLowerCase();
    return {
      reply:
        `I'm here to help, ${ctx.user.name}! As a **${roleLabel}**, you can ask me about:\n\n` +
        '📚 **Book recommendations**\n' +
        '📖 **Borrowing rules & status**\n' +
        '📋 **Reading lists**\n' +
        '🔍 **Catalog search**\n\n' +
        'What would you like to know?',
      modelUsed: 'rule-based',
    };
  }

  isAdminAction(text: string): boolean {
    return this.matches(text, [
      'delete user', 'deactivate user', 'activate user',
      'approve material', 'reject material',
      'manage user', 'change role', 'system setting',
      'delete book', 'remove book',
    ]);
  }

  looksLikeInterests(text: string): boolean {
    const trimmed = text.trim();
    // Must contain a comma or be a short list of words (2-6 words, no question marks)
    if (trimmed.includes('?')) return false;
    if (trimmed.includes(',') && trimmed.length > 3 && trimmed.length < 200) return true;
    return false;
  }

  parseInterests(text: string): string[] {
    return text
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length < 50);
  }

  private matches(text: string, keywords: string[]): boolean {
    return keywords.some((kw) => text.includes(kw));
  }
}
