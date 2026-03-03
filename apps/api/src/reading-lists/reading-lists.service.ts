import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReadingListDto, UpdateReadingListDto, AddReadingListItemDto } from './dto/reading-lists.dto';

@Injectable()
export class ReadingListsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMyLists(userId: string) {
    return this.prisma.readingList.findMany({
      where: { ownerId: userId },
      include: {
        items: {
          include: {
            book: {
              select: {
                id: true,
                title: true,
                authors: true,
                coverImageUrl: true,
              },
            },
          },
          orderBy: { orderIndex: 'asc' },
        },
        _count: { select: { items: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const list = await this.prisma.readingList.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            book: {
              select: {
                id: true,
                title: true,
                authors: true,
                coverImageUrl: true,
                isbn: true,
              },
            },
          },
          orderBy: { orderIndex: 'asc' },
        },
        _count: { select: { items: true } },
      },
    });
    if (!list) {
      throw new NotFoundException('Reading list not found');
    }
    return list;
  }

  async create(ownerId: string, dto: CreateReadingListDto) {
    return this.prisma.readingList.create({
      data: {
        title: dto.title,
        description: dto.description,
        courseCode: dto.courseCode,
        semester: dto.semester,
        ownerId,
      },
      include: {
        items: true,
        _count: { select: { items: true } },
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateReadingListDto) {
    const list = await this.prisma.readingList.findUnique({ where: { id } });
    if (!list) {
      throw new NotFoundException('Reading list not found');
    }
    if (list.ownerId !== userId) {
      throw new ForbiddenException('You can only edit your own reading lists');
    }
    return this.prisma.readingList.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.courseCode !== undefined && { courseCode: dto.courseCode }),
        ...(dto.semester !== undefined && { semester: dto.semester }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        items: {
          include: {
            book: {
              select: { id: true, title: true, authors: true, coverImageUrl: true },
            },
          },
          orderBy: { orderIndex: 'asc' },
        },
        _count: { select: { items: true } },
      },
    });
  }

  async remove(id: string, userId: string) {
    const list = await this.prisma.readingList.findUnique({ where: { id } });
    if (!list) {
      throw new NotFoundException('Reading list not found');
    }
    if (list.ownerId !== userId) {
      throw new ForbiddenException('You can only delete your own reading lists');
    }
    await this.prisma.readingList.delete({ where: { id } });
    return { message: 'Reading list deleted successfully' };
  }

  async addItem(listId: string, userId: string, dto: AddReadingListItemDto) {
    const list = await this.prisma.readingList.findUnique({ where: { id: listId } });
    if (!list) {
      throw new NotFoundException('Reading list not found');
    }
    if (list.ownerId !== userId) {
      throw new ForbiddenException('You can only modify your own reading lists');
    }

    // Check book exists
    const book = await this.prisma.book.findUnique({ where: { id: dto.bookId } });
    if (!book) {
      throw new NotFoundException('Book not found');
    }

    // Get next order index
    const maxItem = await this.prisma.readingListItem.findFirst({
      where: { readingListId: listId },
      orderBy: { orderIndex: 'desc' },
    });
    const nextOrder = maxItem ? maxItem.orderIndex + 1 : 0;

    try {
      const item = await this.prisma.readingListItem.create({
        data: {
          readingListId: listId,
          bookId: dto.bookId,
          notes: dto.notes,
          orderIndex: nextOrder,
        },
        include: {
          book: {
            select: { id: true, title: true, authors: true, coverImageUrl: true },
          },
        },
      });

      // Touch the reading list's updatedAt
      await this.prisma.readingList.update({
        where: { id: listId },
        data: { updatedAt: new Date() },
      });

      return item;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('This book is already in the reading list');
      }
      throw error;
    }
  }

  async removeItem(listId: string, itemId: string, userId: string) {
    const list = await this.prisma.readingList.findUnique({ where: { id: listId } });
    if (!list) {
      throw new NotFoundException('Reading list not found');
    }
    if (list.ownerId !== userId) {
      throw new ForbiddenException('You can only modify your own reading lists');
    }

    const item = await this.prisma.readingListItem.findFirst({
      where: { id: itemId, readingListId: listId },
    });
    if (!item) {
      throw new NotFoundException('Item not found in this reading list');
    }

    await this.prisma.readingListItem.delete({ where: { id: itemId } });

    // Touch the reading list's updatedAt
    await this.prisma.readingList.update({
      where: { id: listId },
      data: { updatedAt: new Date() },
    });

    return { message: 'Item removed from reading list' };
  }
}
