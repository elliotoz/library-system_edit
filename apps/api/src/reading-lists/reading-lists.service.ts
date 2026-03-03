import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReadingListDto } from './dto/reading-lists.dto';

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
          orderBy: { order: 'asc' },
        },
        _count: { select: { items: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(ownerId: string, dto: CreateReadingListDto) {
    return this.prisma.readingList.create({
      data: {
        title: dto.title,
        description: dto.description,
        ownerId,
      },
      include: {
        items: true,
        _count: { select: { items: true } },
      },
    });
  }
}
