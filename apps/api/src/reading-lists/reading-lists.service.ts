import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateReadingListDto, UpdateReadingListDto, AddReadingListItemDto } from './dto/reading-lists.dto';
import { ReadingListVisibility, ReadingListStatus, NotificationType, Role } from '@prisma/client';

const listInclude = {
  owner: { select: { id: true, name: true, email: true, avatarUrl: true, bio: true, department: true, courses: true } },
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

/** Minimal locked response for FOLLOWERS_ONLY lists seen by non-followers */
function lockedPreview(list: any) {
  return {
    id: list.id,
    title: list.title,
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

@Injectable()
export class ReadingListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Owner endpoints ───────────────────────────────────────────

  async findMyLists(userId: string) {
    return this.prisma.readingList.findMany({
      where: { ownerId: userId },
      include: listInclude,
      orderBy: { updatedAt: 'desc' },
      take: 50,
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
        status: dto.status ?? ReadingListStatus.DRAFT,
        ownerId,
      },
      include: {
        items: true,
        _count: { select: { items: true } },
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateReadingListDto, userRole?: Role) {
    const list = await this.prisma.readingList.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });
    if (!list) {
      throw new NotFoundException('Reading list not found');
    }
    const isAdmin = userRole === Role.ADMIN;
    if (list.ownerId !== userId && !isAdmin) {
      throw new ForbiddenException('You can only edit your own reading lists');
    }

    // Publish guard: cannot publish with 0 items
    if (dto.status === ReadingListStatus.PUBLISHED && list._count.items === 0) {
      throw new BadRequestException('Cannot publish a reading list with no books. Add at least one book first.');
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

    // Notify followers on publish transition
    if (
      dto.status === ReadingListStatus.PUBLISHED &&
      previousStatus !== ReadingListStatus.PUBLISHED
    ) {
      await this.notifyFollowers(list.ownerId, id, updated.title, NotificationType.READING_LIST_PUBLISHED);
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
    // Delete notifications tied to this list before removing it
    await this.prisma.notification.deleteMany({
      where: {
        readingListId: id,
        type: { in: [NotificationType.READING_LIST_PUBLISHED, NotificationType.READING_LIST_UPDATED] },
      },
    });
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
        await this.notifyFollowers(list.ownerId, listId, list.title, NotificationType.READING_LIST_UPDATED);
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

    // Notify followers if published list was updated
    if (list.status === ReadingListStatus.PUBLISHED) {
      await this.notifyFollowers(list.ownerId, listId, list.title, NotificationType.READING_LIST_UPDATED);
    }

    return { message: 'Item removed from reading list' };
  }

  // ── Discovery endpoints ───────────────────────────────────────

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

    // Owner always gets full access
    if (isOwner) return list;

    // ARCHIVED: owner-only
    if (list.status === ReadingListStatus.ARCHIVED) {
      throw new NotFoundException('Reading list not found');
    }

    // Admin sees non-archived
    if (isAdmin) return list;

    // PRIVATE: not visible to others
    if (list.visibility === ReadingListVisibility.PRIVATE) {
      throw new NotFoundException('Reading list not found');
    }

    // Only PUBLISHED lists are discoverable for regular users
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
      return lockedPreview(list);
    }

    return list;
  }

  async findGlobalFeed(userId: string, userRole: Role) {
    const followRecords = await this.prisma.instructorFollower.findMany({
      where: { followerId: userId },
      select: { instructorId: true },
    });
    const followedIds = new Set(followRecords.map((f) => f.instructorId));

    // Feed: only PUBLISHED, exclude PRIVATE and ARCHIVED
    const lists = await this.prisma.readingList.findMany({
      where: {
        status: ReadingListStatus.PUBLISHED,
        visibility: { not: ReadingListVisibility.PRIVATE },
      },
      include: listInclude,
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    return lists.map((list) => {
      if (list.ownerId === userId) return list;
      if (
        list.visibility === ReadingListVisibility.FOLLOWERS_ONLY &&
        !followedIds.has(list.ownerId)
      ) {
        return lockedPreview(list);
      }
      return list;
    });
  }

  async findByInstructor(instructorId: string, userId: string, userRole: Role) {
    const instructor = await this.prisma.user.findUnique({
      where: { id: instructorId },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true, bio: true, department: true, courses: true },
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

    // Owner sees all; admin sees non-archived; others see only PUBLISHED, non-PRIVATE, non-ARCHIVED
    let where: any;
    if (isOwner) {
      where = { ownerId: instructorId };
    } else if (isAdmin) {
      where = { ownerId: instructorId, status: { not: ReadingListStatus.ARCHIVED } };
    } else {
      where = {
        ownerId: instructorId,
        status: ReadingListStatus.PUBLISHED,
        visibility: { not: ReadingListVisibility.PRIVATE },
      };
    }

    const lists = await this.prisma.readingList.findMany({
      where,
      include: listInclude,
      orderBy: { updatedAt: 'desc' },
    });

    const processedLists = lists.map((list) => {
      if (isOwner || isAdmin) return list;
      if (list.visibility === ReadingListVisibility.FOLLOWERS_ONLY && !isFollower) {
        return lockedPreview(list);
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

  // ── Admin moderation ──────────────────────────────────────────

  async findAllForModeration() {
    return this.prisma.readingList.findMany({
      where: { status: { not: ReadingListStatus.ARCHIVED } },
      include: listInclude,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  // ── Helpers ───────────────────────────────────────────────────

  private async notifyFollowers(instructorId: string, listId: string, listTitle: string, type: NotificationType) {
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
        readingListId: listId,
      })),
    );
  }
}
