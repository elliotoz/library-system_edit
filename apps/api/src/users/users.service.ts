// src/users/users.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { UpdateProfileDto } from './dto/update-profile.dto';

// Fields that are safe to return to any caller. Sensitive auth fields
// (password, verification tokens, reset tokens) are intentionally absent —
// they must never be loaded by a query that returns data to the client.
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  authProvider: true,
  emailVerifiedAt: true,
  studentId: true,
  staffId: true,
  facultyId: true,
  interests: true,
  bio: true,
  department: true,
  courses: true,
  avatarUrl: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  lastLogin: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find all users (admin only)
   */
  async findAll(params?: {
    role?: Role;
    facultyId?: string;
    isActive?: boolean;
    search?: string;
    skip?: number;
    take?: number;
  }) {
    const { role, facultyId, isActive, search, skip = 0, take = 10 } = params || {};

    const where: any = {};

    if (role) {
      where.role = role;
    }

    if (facultyId) {
      where.facultyId = facultyId;
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { studentId: { contains: search, mode: 'insensitive' } },
        { staffId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        select: { ...SAFE_USER_SELECT, faculty: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page: Math.floor(skip / take) + 1,
        pageSize: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Find user by ID
   */
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...SAFE_USER_SELECT,
        faculty: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            defaultBranchId: true,
            defaultBranch: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { ...SAFE_USER_SELECT, faculty: true },
    });
  }

  /**
   * Update current user profile (self-service)
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;
    if (dto.bio !== undefined) data.bio = dto.bio;
    if (dto.department !== undefined) data.department = dto.department;
    if (dto.courses !== undefined) data.courses = dto.courses;

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: { ...SAFE_USER_SELECT, faculty: true },
    });
  }

  /**
   * Update user interests (for staff)
   */
  async updateInterests(userId: string, interests: string[]) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { interests },
      select: { ...SAFE_USER_SELECT, faculty: true },
    });
  }

  async getPreferences(userId: string): Promise<{ notificationPrefs: Record<string, boolean> }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    });

    if (!user) throw new NotFoundException('User not found');

    const prefs = (user.notificationPrefs as Record<string, boolean>) ?? {
      emailNotifications: true,
      dueDateReminders: true,
      reservationAlerts: true,
    };

    return { notificationPrefs: prefs };
  }

  async updatePreferences(userId: string, prefs: {
    emailNotifications?: boolean;
    dueDateReminders?: boolean;
    reservationAlerts?: boolean;
  }): Promise<{ notificationPrefs: Record<string, boolean> }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    });

    if (!user) throw new NotFoundException('User not found');

    const current = (user.notificationPrefs as Record<string, boolean>) ?? {
      emailNotifications: true,
      dueDateReminders: true,
      reservationAlerts: true,
    };

    const merged = { ...current, ...prefs };

    await this.prisma.user.update({
      where: { id: userId },
      data: { notificationPrefs: merged },
    });

    return { notificationPrefs: merged };
  }

  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        studentId: true,
        staffId: true,
        bio: true,
        department: true,
        interests: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const [borrows, reservations, readingLists] = await Promise.all([
      this.prisma.borrow.findMany({
        where: { userId },
        select: {
          id: true,
          status: true,
          borrowedAt: true,
          dueAt: true,
          returnedAt: true,
          bookCopy: {
            select: {
              book: { select: { title: true, authors: true } },
            },
          },
        },
        orderBy: { borrowedAt: 'desc' },
      }),
      this.prisma.reservation.findMany({
        where: { userId },
        select: {
          id: true,
          status: true,
          createdAt: true,
          expiresAt: true,
          bookCopy: {
            select: {
              book: { select: { title: true, authors: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.readingList.findMany({
        where: { ownerId: userId },
        select: {
          id: true,
          title: true,
          description: true,
          visibility: true,
          createdAt: true,
          items: {
            select: {
              book: { select: { title: true, authors: true } },
              createdAt: true,
            },
          },
        },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: user,
      borrows: borrows.map((b) => ({
        id: b.id,
        status: b.status,
        borrowedAt: b.borrowedAt,
        dueAt: b.dueAt,
        returnedAt: b.returnedAt,
        book: b.bookCopy?.book?.title ?? 'Unknown',
        authors: b.bookCopy?.book?.authors ?? [],
      })),
      reservations: reservations.map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        book: r.bookCopy?.book?.title ?? 'Unknown',
        authors: r.bookCopy?.book?.authors ?? [],
      })),
      readingLists: readingLists.map((rl) => ({
        id: rl.id,
        title: rl.title,
        description: rl.description,
        visibility: rl.visibility,
        createdAt: rl.createdAt,
        books: rl.items.map((item) => ({
          title: item.book?.title ?? 'Unknown',
          authors: item.book?.authors ?? [],
          addedAt: item.createdAt,
        })),
      })),
    };
  }

  /**
   * Get user statistics
   */
  async getUserStats() {
    const [total, students, instructors, staff, admins, activeUsers] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: Role.STUDENT } }),
      this.prisma.user.count({ where: { role: Role.INSTRUCTOR } }),
      this.prisma.user.count({ where: { role: Role.STAFF } }),
      this.prisma.user.count({ where: { role: Role.ADMIN } }),
      this.prisma.user.count({ where: { isActive: true } }),
    ]);

    return {
      total,
      byRole: {
        students,
        instructors,
        staff,
        admins,
      },
      activeUsers,
      inactiveUsers: total - activeUsers,
    };
  }

  /**
   * Deactivate user (admin only)
   */
  async deactivateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    return { message: 'User deactivated successfully' };
  }

  /**
   * Activate user (admin only)
   */
  async activateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });

    return { message: 'User activated successfully' };
  }
}
