import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateReadingListDto, UpdateReadingListDto, AddReadingListItemDto } from './dto/reading-lists.dto';
import { ReadingListVisibility, ReadingListStatus, NotificationType, Role } from '@prisma/client';

const listInclude = {
  owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
  items: {
    include: {
      book: {
        select: { id: true, title: true, authors: true, coverImageUrl: true, isbn: true },
      },
    },
    orderBy: { orderIndex: 'asc' as const },
  },
  _count: { select: { items: true } },
};

const metadataOnly = {
  owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
  _count: { select: { items: true } },
};

@Injectable()
export class ReadingListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Owner endpoints (existing) ────────────────────────────────

  async findMyLists(userId: string) {
    return this.prisma.readingList.findMany({
      where: { ownerId: userId },
      include: listInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(ownerId: string, dto: CreateReadingListDto) {
    return this.prisma.readingList.create({
      data: {
        title: dto.title,
        description: dto.description,
        courseCode: dto.courseCode,
        semester: dto.semester,
        visibility: dto.visibility ?? ReadingListVisibility.PUBLIC,
        ownerId,
      },
      include: {
        items: true,
        _count: { select: { items: true } },
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateReadingListDto, userRole?: Role) {
    const list = await this.prisma.readingList.findUnique({ where: { id } });
    if (!list) {
      throw new NotFoundException('Reading list not found');
    }
    const isAdmin = userRole === Role.ADMIN;
    if (list.ownerId !== userId && !isAdmin) {
      throw new ForbiddenException('You can only edit your own reading lists');
    }

    const previousStatus = list.status;

    const updated = await this.prisma.readingList.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.courseCode !== undefined && { courseCode: dto.courseCode }),
        ...(dto.semester !== undefined && { semester: dto.semester }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.visibility !== undefined && { visibility: dto.visibility }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: listInclude,
    });

    // Notify followers on publish or content update
    if (
      dto.status === ReadingListStatus.PUBLISHED &&
      previousStatus !== ReadingListStatus.PUBLISHED
    ) {
      await this.notifyFollowers(list.ownerId, updated.title, NotificationType.READING_LIST_PUBLISHED);
    }

    return updated;
  }

  async remove(id: string, userId: string, userRole?: Role) {
    const list = await this.prisma.readingList.findUnique({ where: { id } });
    if (!list) {
      throw new NotFoundException('Reading list not found');
    }
    const isAdmin = userRole === Role.ADMIN;
    if (list.ownerId !== userId && !isAdmin) {
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

    const book = await this.prisma.book.findUnique({ where: { id: dto.bookId } });
    if (!book) {
      throw new NotFoundException('Book not found');
    }

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

      await this.prisma.readingList.update({
        where: { id: listId },
        data: { updatedAt: new Date() },
      });

      // Notify followers if published list was updated
      if (list.status === ReadingListStatus.PUBLISHED) {
        await this.notifyFollowers(list.ownerId, list.title, NotificationType.READING_LIST_UPDATED);
      }

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
    await this.prisma.readingList.update({
      where: { id: listId },
      data: { updatedAt: new Date() },
    });

    return { message: 'Item removed from reading list' };
  }

  // ── Discovery endpoints (new) ──────────────────────────────────

  async findOneForUser(id: string, userId: string, userRole: Role) {
    const list = await this.prisma.readingList.findUnique({
      where: { id },
      include: listInclude,
    });
    if (!list) {
      throw new NotFoundException('Reading list not found');
    }

    const isOwner = list.ownerId === userId;
    const isAdmin = userRole === Role.ADMIN;

    // Owner and admin always get full access
    if (isOwner || isAdmin) return list;

    // PRIVATE: not visible to others
    if (list.visibility === ReadingListVisibility.PRIVATE) {
      throw new NotFoundException('Reading list not found');
    }

    // Only PUBLISHED lists are discoverable
    if (list.status !== ReadingListStatus.PUBLISHED) {
      throw new NotFoundException('Reading list not found');
    }

    // PUBLIC: full access
    if (list.visibility === ReadingListVisibility.PUBLIC) return list;

    // FOLLOWERS_ONLY: check follow status
    if (list.visibility === ReadingListVisibility.FOLLOWERS_ONLY) {
      const isFollower = await this.prisma.instructorFollower.findUnique({
        where: { followerId_instructorId: { followerId: userId, instructorId: list.ownerId } },
      });
      if (isFollower) return list;

      // Non-follower: return metadata only with lock flag
      return {
        id: list.id,
        title: list.title,
        description: list.description,
        courseCode: list.courseCode,
        semester: list.semester,
        isActive: list.isActive,
        visibility: list.visibility,
        status: list.status,
        ownerId: list.ownerId,
        owner: list.owner,
        createdAt: list.createdAt,
        updatedAt: list.updatedAt,
        _count: list._count,
        items: [],
        locked: true,
      };
    }

    return list;
  }

  async findGlobalFeed(userId: string, userRole: Role) {
    // Get IDs of instructors the user follows
    const followRecords = await this.prisma.instructorFollower.findMany({
      where: { followerId: userId },
      select: { instructorId: true },
    });
    const followedIds = new Set(followRecords.map((f) => f.instructorId));

    const isAdmin = userRole === Role.ADMIN;

    // Fetch all published, non-private lists (admins see everything)
    const lists = await this.prisma.readingList.findMany({
      where: isAdmin
        ? {}
        : {
            status: ReadingListStatus.PUBLISHED,
            visibility: { not: ReadingListVisibility.PRIVATE },
          },
      include: listInclude,
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    // Apply visibility: strip items from FOLLOWERS_ONLY if not following
    return lists.map((list) => {
      if (isAdmin || list.ownerId === userId) return list;

      if (
        list.visibility === ReadingListVisibility.FOLLOWERS_ONLY &&
        !followedIds.has(list.ownerId)
      ) {
        return {
          ...list,
          items: [],
          locked: true,
        };
      }
      return list;
    });
  }

  async findByInstructor(instructorId: string, userId: string, userRole: Role) {
    const instructor = await this.prisma.user.findUnique({
      where: { id: instructorId },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true },
    });
    if (!instructor || instructor.role !== Role.INSTRUCTOR) {
      throw new NotFoundException('Instructor not found');
    }

    const isOwner = instructorId === userId;
    const isAdmin = userRole === Role.ADMIN;

    const isFollower = !isOwner && !isAdmin
      ? !!(await this.prisma.instructorFollower.findUnique({
          where: { followerId_instructorId: { followerId: userId, instructorId } },
        }))
      : false;

    const followersCount = await this.prisma.instructorFollower.count({
      where: { instructorId },
    });

    // Owner/admin see all; others see only published non-private
    const where = isOwner || isAdmin
      ? { ownerId: instructorId }
      : { ownerId: instructorId, status: ReadingListStatus.PUBLISHED, visibility: { not: ReadingListVisibility.PRIVATE } };

    const lists = await this.prisma.readingList.findMany({
      where,
      include: listInclude,
      orderBy: { updatedAt: 'desc' },
    });

    const processedLists = lists.map((list) => {
      if (isOwner || isAdmin) return list;
      if (list.visibility === ReadingListVisibility.FOLLOWERS_ONLY && !isFollower) {
        return { ...list, items: [], locked: true };
      }
      return list;
    });

    return {
      instructor,
      followersCount,
      isFollowing: isFollower,
      readingLists: processedLists,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────

  private async notifyFollowers(instructorId: string, listTitle: string, type: NotificationType) {
    const followers = await this.prisma.instructorFollower.findMany({
      where: { instructorId },
      select: { followerId: true },
    });

    if (followers.length === 0) return;

    const instructor = await this.prisma.user.findUnique({
      where: { id: instructorId },
      select: { name: true },
    });

    const isPublish = type === NotificationType.READING_LIST_PUBLISHED;
    const title = isPublish ? 'New Reading List Published' : 'Reading List Updated';
    const message = isPublish
      ? `${instructor?.name} published a new reading list: "${listTitle}"`
      : `${instructor?.name} updated their reading list: "${listTitle}"`;

    await this.notifications.createMany(
      followers.map((f) => ({
        userId: f.followerId,
        type,
        title,
        message,
      })),
    );
  }
}
