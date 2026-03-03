import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class InstructorFollowersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyFollowing(userId: string) {
    return this.prisma.instructorFollower.findMany({
      where: { followerId: userId },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async follow(followerId: string, instructorId: string) {
    if (followerId === instructorId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    // Verify target is an INSTRUCTOR
    const instructor = await this.prisma.user.findUnique({
      where: { id: instructorId },
      select: { id: true, role: true },
    });
    if (!instructor) {
      throw new NotFoundException('User not found');
    }
    if (instructor.role !== Role.INSTRUCTOR) {
      throw new BadRequestException('You can only follow instructors');
    }

    // Idempotent: if already following, return existing record
    const existing = await this.prisma.instructorFollower.findUnique({
      where: { followerId_instructorId: { followerId, instructorId } },
    });
    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.instructorFollower.create({
        data: { followerId, instructorId },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Race condition — already followed between check and create
        return this.prisma.instructorFollower.findUnique({
          where: { followerId_instructorId: { followerId, instructorId } },
        });
      }
      throw error;
    }
  }

  async unfollow(followerId: string, instructorId: string) {
    // Idempotent: if not following, just return success
    const existing = await this.prisma.instructorFollower.findUnique({
      where: { followerId_instructorId: { followerId, instructorId } },
    });
    if (!existing) {
      return { message: 'Unfollowed successfully' };
    }

    await this.prisma.instructorFollower.delete({
      where: { id: existing.id },
    });
    return { message: 'Unfollowed successfully' };
  }

  async getFollowersCount(instructorId: string) {
    const count = await this.prisma.instructorFollower.count({
      where: { instructorId },
    });
    return { instructorId, count };
  }

  async isFollowing(followerId: string, instructorId: string) {
    const record = await this.prisma.instructorFollower.findUnique({
      where: { followerId_instructorId: { followerId, instructorId } },
    });
    return { instructorId, isFollowing: !!record };
  }
}
