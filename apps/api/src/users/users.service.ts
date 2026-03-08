// src/users/users.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UpdateProfileDto } from './dto/update-profile.dto';

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
        include: {
          faculty: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Remove passwords
    const usersWithoutPasswords = users.map(({ password, ...user }) => user);

    return {
      data: usersWithoutPasswords,
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
      include: {
        faculty: {
          include: {
            defaultBranch: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        faculty: true,
      },
    });

    if (!user) {
      return null;
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
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

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      include: { faculty: true },
    });

    const { password, ...userWithoutPassword } = updated;
    return userWithoutPassword;
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

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { interests },
      include: { faculty: true },
    });

    const { password, ...userWithoutPassword } = updated;
    return userWithoutPassword;
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
