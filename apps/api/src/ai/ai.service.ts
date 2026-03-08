import { Injectable } from '@nestjs/common';

export interface ChatResponse {
  reply: string;
  sources?: string[];
}

@Injectable()
export class AiService {
  chat(message: string): ChatResponse {
    const lower = message.toLowerCase();

    if (this.matches(lower, ['borrow', 'return', 'renew', 'extend', 'overdue', 'fine', 'due date'])) {
      return {
        reply:
          'Here\'s how borrowing works:\n\n' +
          '📖 **Borrow Limits:**\n' +
          '- Students: 5 books for 14 days\n' +
          '- Instructors: 10 books for 30 days\n\n' +
          '🔄 **Extensions:** You can extend loans from the "My Borrowed Books" page (up to 2 extensions for students, 3 for instructors).\n\n' +
          '⚠️ **Overdue:** Please return books on time to avoid restrictions on future borrowing.',
        sources: ['/dashboard/borrowed'],
      };
    }

    if (this.matches(lower, ['reserve', 'reservation', 'pick up', 'pickup', 'hold'])) {
      return {
        reply:
          'To reserve a book:\n\n' +
          '1. Find the book in the **Catalog**\n' +
          '2. Check availability at your campus branch\n' +
          '3. Click **"Reserve"** to hold it\n' +
          '4. Pick it up within 7 days\n\n' +
          '📋 **Reservation Limits:** Students can have up to 3 active reservations, instructors up to 5.',
        sources: ['/dashboard/catalog', '/dashboard/reservations'],
      };
    }

    if (this.matches(lower, ['catalog', 'search', 'find book', 'looking for', 'available'])) {
      return {
        reply:
          'You can search the library catalog to find books by title, author, ISBN, or subject.\n\n' +
          '🔍 Go to the **Catalog** page to browse and search.\n' +
          'Each book page shows availability across campus branches.\n\n' +
          'Need a specific recommendation? Tell me the subject or topic you\'re interested in!',
        sources: ['/dashboard/catalog'],
      };
    }

    if (this.matches(lower, ['reading list', 'course material', 'instructor list', 'syllabus'])) {
      return {
        reply:
          'Reading lists are curated by instructors for their courses.\n\n' +
          '📚 Browse published reading lists on the **Reading Lists** page.\n' +
          '👤 You can also visit instructor profiles to see all their lists.\n' +
          '🔔 Follow an instructor to get notified when they publish new lists.',
        sources: ['/dashboard/reading-lists'],
      };
    }

    if (this.matches(lower, ['instructor', 'professor', 'follow', 'teacher'])) {
      return {
        reply:
          'You can discover and follow instructors:\n\n' +
          '👤 Visit an instructor\'s public profile to see their bio, department, and courses.\n' +
          '📚 View their published reading lists.\n' +
          '🔔 Follow them to get notified about new reading lists.\n\n' +
          'Find instructors through reading lists or ask me about a specific department!',
        sources: ['/dashboard/reading-lists'],
      };
    }

    if (this.matches(lower, ['recommend', 'suggest', 'what should i read', 'good book'])) {
      return {
        reply:
          'I\'d love to help you find great books! Tell me:\n\n' +
          '1. **What subject or topic** are you interested in?\n' +
          '2. **What\'s your purpose** — coursework, research, or personal reading?\n' +
          '3. **Any favorite authors** or books you\'ve enjoyed?\n\n' +
          'You can also check the **Catalog** to browse by category or explore instructor **Reading Lists** for curated selections.',
        sources: ['/dashboard/catalog', '/dashboard/reading-lists'],
      };
    }

    if (this.matches(lower, ['material', 'research paper', 'publication', 'thesis', 'submit'])) {
      return {
        reply:
          'The library hosts academic materials including research papers, theses, and course materials.\n\n' +
          '📄 Browse available materials on the **Materials** page.\n' +
          '📤 Instructors can submit materials for review via their dashboard.\n\n' +
          'All submissions go through an approval process before being published.',
        sources: ['/dashboard/materials'],
      };
    }

    if (this.matches(lower, ['help', 'what can you do', 'how does this work'])) {
      return {
        reply:
          'I can help you with:\n\n' +
          '📚 **Book Search & Recommendations** — Find books or get suggestions\n' +
          '📖 **Borrowing & Reservations** — How to borrow, renew, or reserve\n' +
          '📋 **Reading Lists** — Discover instructor-curated lists\n' +
          '📄 **Academic Materials** — Find research papers and publications\n' +
          '👤 **Instructor Profiles** — Follow instructors and view their work\n\n' +
          'Just ask me anything!',
      };
    }

    // Default fallback
    return {
      reply:
        'I\'m here to help you with the library! You can ask me about:\n\n' +
        '📚 **Book recommendations** — Personalized suggestions\n' +
        '🔍 **Catalog search** — Finding specific books\n' +
        '📖 **Borrowing rules** — Limits, extensions, returns\n' +
        '📋 **Reading lists** — Instructor-curated materials\n' +
        '📄 **Academic materials** — Research and publications\n\n' +
        'What would you like to know?',
    };
  }

  private matches(text: string, keywords: string[]): boolean {
    return keywords.some((kw) => text.includes(kw));
  }
}
